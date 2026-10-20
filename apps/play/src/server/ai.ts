// The AI server (design "AI features", Interfaces #5): the four `runs.parse` features on the signed-in person's own runtime.
//
// `runAi(deps, userId, request, signal)` authorizes first, then loads the stored document, builds the prompt from it and the
// catalogue (`ai-prompts.ts`), starts one run and maps how it ended. INV-AUTHZ: a refusal returns before any prompt exists
// and before the runtime is touched. INV-AI: nothing here writes D1, and the GM assistant never reads `journal_entry`.
// Expected outcomes are values: `result`, `failed` (a run that did not give a result), or `refused` (authorization or input).
import { createServerFn } from '@tanstack/react-start'
import type { ConnectedCrouter } from '@north-light/sdk'
import { needsSignIn } from '@heartrush/northlight/runs'
import { upgradeCharacter } from '@heartrush/rules-engine/actions'
import { effectiveMaxHp, maxHp } from '@heartrush/rules-engine/derived'
import { previewDraft } from '@heartrush/rules-engine/draft'
import { xpRemaining } from '@heartrush/rules-engine/pricing'
import { RuleError, type Character } from '@heartrush/rules-engine/types'
import type { z } from 'zod'
import { getCatalogue, rulebookUrl } from '../catalogue'
import { characterRole, roleIn } from './authz'
import {
  abilityText, explainAspectPrompt, explainAspectSchema, explainPrompt, explainSchema, gmAssistantPrompt, gmAssistantSchema,
  offeredTalents, sheetMarkdown, suggestPrompt, suggestSchema,
  type ExplainAspectValue, type ExplainValue, type GmAssistantValue,
} from './ai-prompts'

// ---- Types -------------------------------------------------------------------------------------

/** What the page asks for. `characterId` names a finished character or the caller's own draft; `talentId` is the character's talent record id, or a catalogue talent id for a row the character does not own. */
export type AiRequest =
  | { feature: 'explain'; characterId: string; input: { talentId: string } }
  | { feature: 'explainAspect'; characterId: string; input: { aspectId: string } }
  | { feature: 'suggest'; characterId: string; input?: Record<string, never> }
  | { feature: 'gmAssistant'; campaignId: string; input: { question: string } }

/** A suggestion as the cards show it: the model's reason, with the title, price and rulebook path taken from the catalogue. */
export type SuggestedTalent = {
  talentId: string
  title: string
  category: 'combat' | 'noncombat' | 'elemental'
  frequency: string | null
  /** XP the character pays now (`price`). */
  price: number
  /** Where the full text is on the rules site. */
  path: string
  rulebookUrl: string
  reason: string
}
export type SuggestValue = { suggestions: SuggestedTalent[] }

export type AiValue = ExplainValue | ExplainAspectValue | SuggestValue | GmAssistantValue

/** Why a run gave no result. `not_connected`: the person must sign in again (a refused refresh, or no stored connection). */
export type AiFailure = 'declined' | 'deadline_exceeded' | 'runtime_error' | 'not_connected'

export type AiErrorCode = 'forbidden' | 'not_found' | 'bad_input' | 'draft_invalid'
export type AiRefusal = { kind: 'refused'; status: number; code: AiErrorCode; message: string }

export type AiOutcome<V extends AiValue = AiValue> = { kind: 'result'; value: V } | { kind: 'failed'; reason: AiFailure } | AiRefusal

/** The part of the person's runtime this module calls. `ConnectedCrouter` satisfies it; tests supply a stub. */
export type AiRuntime = Pick<ConnectedCrouter, 'runs'>

export type AiDeps = { db: D1Database; runtimeFor: (userId: string) => Promise<AiRuntime> }

// ---- Constants and helpers ----------------------------------------------------------------------

const SCOPES = ['crtr:llm', 'crtr:act']
/** The run's own wall-clock limit (it settles `deadline_exceeded`)... */
const RUN_DEADLINE = '60s'
/** ...and the call's overall budget, a little longer, so a daemon that never answers still ends. */
const CALL_BUDGET_MS = 65_000

export const MAX_QUESTION_LENGTH = 2000
const MAX_SUGGESTIONS = 5

const STATUS: Record<AiErrorCode, number> = { forbidden: 403, not_found: 404, bad_input: 400, draft_invalid: 422 }
const refuse = (code: AiErrorCode, message: string): AiRefusal => ({ kind: 'refused', status: STATUS[code], code, message })

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

type CharacterRow = { owner_user_id: string; campaign_id: string | null; name: string; state: string }

/** The character as a prompt sees it: a finished character as stored, a draft through `previewDraft` (ruling 13). */
function characterOf(row: CharacterRow): Character | AiRefusal {
  const state = upgradeCharacter(JSON.parse(row.state))
  if (!state.draft) return state
  try {
    return previewDraft(state, getCatalogue()).character
  } catch (error) {
    if (error instanceof RuleError) return refuse('draft_invalid', `The draft cannot be built yet: ${error.message}`)
    throw error
  }
}

const isRefusal = (v: object): v is AiRefusal => 'kind' in v && (v as { kind: unknown }).kind === 'refused'

/** The character the viewer may read, or the refusal. Authorization precedes everything else (INV-AUTHZ). */
async function readableCharacter(db: D1Database, userId: string, characterId: unknown): Promise<Character | AiRefusal> {
  if (!nonEmpty(characterId)) return refuse('bad_input', 'characterId must be a non-empty string')
  const row = await db.prepare('SELECT owner_user_id, campaign_id, name, state FROM character WHERE id = ?').bind(characterId).first<CharacterRow>()
  if (!row) return refuse('not_found', 'No such character')
  const draft = upgradeCharacter(JSON.parse(row.state)).draft
  const role = await characterRole(db, userId, { ownerUserId: row.owner_user_id, campaignId: row.campaign_id, draft })
  if (!role) return refuse('forbidden', 'You cannot see this character')
  return characterOf(row)
}

/**
 * Start one run on the person's runtime and wait for its result. Never throws for how a run ends: a refused or missing
 * connection is `not_connected`, a declined run `declined`, a run or call past its deadline `deadline_exceeded`, anything else
 * (including a result that does not match the schema) `runtime_error`.
 */
async function parseRun<S extends z.ZodType>(
  deps: AiDeps,
  userId: string,
  prompt: string,
  schema: S,
  signal: AbortSignal | undefined,
): Promise<{ kind: 'result'; value: z.output<S> } | { kind: 'failed'; reason: AiFailure }> {
  try {
    const runtime = await deps.runtimeFor(userId)
    const outcome = await runtime.runs.parse(
      { prompt, output_schema: schema, scopes: SCOPES, deadline: RUN_DEADLINE },
      { signal, budgetMs: CALL_BUDGET_MS },
    )
    if (outcome.kind === 'result') {
      const parsed = schema.safeParse(outcome.output_parsed)
      if (parsed.success) return { kind: 'result', value: parsed.data }
      console.error('ai: result did not match the schema', parsed.error.message)
      return { kind: 'failed', reason: 'runtime_error' }
    }
    if (outcome.reason === 'declined') return { kind: 'failed', reason: 'declined' }
    if (outcome.reason === 'deadline_exceeded') return { kind: 'failed', reason: 'deadline_exceeded' }
    console.error('ai: run ended without a result', outcome.reason)
    return { kind: 'failed', reason: 'runtime_error' }
  } catch (error) {
    if (needsSignIn(error)) return { kind: 'failed', reason: 'not_connected' }
    if ((error as { code?: string } | null)?.code === 'deadline_exceeded') return { kind: 'failed', reason: 'deadline_exceeded' }
    console.error('ai: run failed', error instanceof Error ? error.message : error)
    return { kind: 'failed', reason: 'runtime_error' }
  }
}

// ---- Features ----------------------------------------------------------------------------------

async function explain(deps: AiDeps, userId: string, req: Extract<AiRequest, { feature: 'explain' }>, signal?: AbortSignal): Promise<AiOutcome> {
  const c = await readableCharacter(deps.db, userId, req.characterId)
  if (isRefusal(c)) return c
  const talentId = req.input?.talentId
  if (!nonEmpty(talentId)) return refuse('bad_input', 'talentId must be a non-empty string')
  const catalogue = getCatalogue()
  const owned = c.talents.find((t) => t.id === talentId) ?? null
  const entry = (owned ? (owned.catalogueId ? catalogue.talents.get(owned.catalogueId) : undefined) : catalogue.talents.get(talentId)) ?? null
  const text = abilityText(owned, entry)
  const title = owned?.titleSnapshot ?? entry?.title
  if (text === null || !title) return refuse('not_found', 'No such ability on this character or in the rulebook')
  return parseRun(deps, userId, explainPrompt(c, title, text), explainSchema, signal)
}

async function explainAspect(deps: AiDeps, userId: string, req: Extract<AiRequest, { feature: 'explainAspect' }>, signal?: AbortSignal): Promise<AiOutcome> {
  const c = await readableCharacter(deps.db, userId, req.characterId)
  if (isRefusal(c)) return c
  const aspectId = req.input?.aspectId
  if (!nonEmpty(aspectId)) return refuse('bad_input', 'aspectId must be a non-empty string')
  const aspect = c.aspects.find((a) => a.id === aspectId)
  if (!aspect) return refuse('not_found', 'No such aspect on this character')
  return parseRun(deps, userId, explainAspectPrompt(c, aspect), explainAspectSchema, signal)
}

async function suggest(deps: AiDeps, userId: string, req: Extract<AiRequest, { feature: 'suggest' }>, signal?: AbortSignal): Promise<AiOutcome> {
  const c = await readableCharacter(deps.db, userId, req.characterId)
  if (isRefusal(c)) return c
  const offered = offeredTalents(c, getCatalogue().talents.values())
  if (offered.length === 0) return { kind: 'result', value: { suggestions: [] } satisfies SuggestValue }
  const run = await parseRun(deps, userId, suggestPrompt(c, offered), suggestSchema, signal)
  if (run.kind === 'failed') return run
  // Only talents the prompt offered can come back: an id the model made up, or one it was not shown, is dropped.
  const byId = new Map(offered.map((o) => [o.talent.id, o]))
  const seen = new Set<string>()
  const suggestions: SuggestedTalent[] = []
  for (const s of run.value.suggestions) {
    const o = byId.get(s.talentId)
    if (!o || seen.has(s.talentId)) continue
    seen.add(s.talentId)
    suggestions.push({
      talentId: o.talent.id, title: o.talent.title, category: o.talent.category, frequency: o.talent.frequency, price: o.price,
      path: o.talent.path, rulebookUrl: rulebookUrl(o.talent.path), reason: s.reason,
    })
    if (suggestions.length === MAX_SUGGESTIONS) break
  }
  return { kind: 'result', value: { suggestions } satisfies SuggestValue }
}

async function gmAssistant(deps: AiDeps, userId: string, req: Extract<AiRequest, { feature: 'gmAssistant' }>, signal?: AbortSignal): Promise<AiOutcome> {
  const { campaignId } = req
  if (!nonEmpty(campaignId)) return refuse('bad_input', 'campaignId must be a non-empty string')
  if ((await roleIn(deps.db, campaignId, userId)) !== 'gm') return refuse('forbidden', 'Only the campaign\'s GM can ask the assistant')
  const question = req.input?.question
  if (!nonEmpty(question)) return refuse('bad_input', 'The question is empty')
  if (question.length > MAX_QUESTION_LENGTH) return refuse('bad_input', `A question is at most ${MAX_QUESTION_LENGTH} characters`)
  const campaign = await deps.db.prepare('SELECT name FROM campaign WHERE id = ?').bind(campaignId).first<{ name: string }>()
  if (!campaign) return refuse('not_found', 'No such campaign')
  const { results } = await deps.db
    .prepare('SELECT owner_user_id, campaign_id, name, state FROM character WHERE campaign_id = ? ORDER BY name, id')
    .bind(campaignId)
    .all<CharacterRow>()
  const conditions = getCatalogue().conditions
  const sheets = results.flatMap((row) => {
    const state = upgradeCharacter(JSON.parse(row.state))
    if (state.draft) return [] // a draft is its owner's alone
    return [sheetMarkdown(state, { effectiveMaxHp: effectiveMaxHp(state), maxHp: maxHp(state), xpRemaining: xpRemaining(state) }, (id) => conditions.get(id)?.title ?? null)]
  })
  return parseRun(deps, userId, gmAssistantPrompt(campaign.name, sheets, question.trim()), gmAssistantSchema, signal)
}

// ---- Entry point -------------------------------------------------------------------------------

/**
 * Run one AI feature for `userId`. Authorization comes first and a refusal starts no run: `explain`, `explainAspect` and
 * `suggest` need read access to the character (a draft is its owner's alone), `gmAssistant` needs the GM role in the campaign,
 * and an unknown feature is 403. Nothing is written to D1. `signal` is the request's: aborting it stops waiting for the run.
 */
export async function runAi(deps: AiDeps, userId: string, request: AiRequest, signal?: AbortSignal): Promise<AiOutcome> {
  switch (request?.feature) {
    case 'explain': return explain(deps, userId, request, signal)
    case 'explainAspect': return explainAspect(deps, userId, request, signal)
    case 'suggest': return suggest(deps, userId, request, signal)
    case 'gmAssistant': return gmAssistant(deps, userId, request, signal)
    default: return refuse('forbidden', 'Unknown AI feature')
  }
}

export const runAiFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => data as AiRequest)
  .handler(async ({ data }): Promise<AiOutcome> => {
    const [{ requireUser }, { authFor }, { env }, { getRequest }] = await Promise.all([
      import('./session'), import('./auth'), import('cloudflare:workers'), import('@tanstack/react-start/server'),
    ])
    const request = getRequest()
    const { userId } = await requireUser(request)
    return runAi({ db: env.DB, runtimeFor: (id) => authFor(request).runtimeFor(id) }, userId, data, request.signal)
  })
