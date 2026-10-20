// The builder's draft (ruling 8). The builder edits `BuilderInput` (steps 1–5) and `pending` (the step 6–7 actions)
// on screen at once; every change is saved with `saveDraft` after a short pause (the only write without an event,
// INV-ACTION). Saves run one at a time, each with the revision the last save returned.
//
// Conflicts are handled the way the sheet's dispatcher handles them (`components/sheet/use-character.ts`): the screen
// keeps the changes made here that have not saved yet, in order. A conflict (another tab saved the draft first)
// returns the server's draft; that draft is the truth, this screen's unsaved changes are reapplied on top of it, the
// result is shown, and it is sent again, once. A change made in another tab is never written over by this one's stale copy.
//
// Leaving the builder (a site link, Back to another page, closing the tab) waits for unsaved changes to save. When the
// save fails the router blocks the navigation and `leaving` asks the player to stay or leave without saving.
//
// `preview` is the character the engine computes from the draft (`previewDraft`), or the reason it cannot yet: a
// builder whose steps are incomplete is refused by `createCharacter`, which is expected until step 5 is done.
import { useBlocker, type ShouldBlockFn } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { createCharacter } from '@heartrush/rules-engine/create'
import { previewDraft } from '@heartrush/rules-engine/draft'
import { RuleError, type AbilityId, type BuilderInput, type Character, type ClientAction, type DraftState, type RuleErrorCode } from '@heartrush/rules-engine/types'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { getCatalogue } from '~/catalogue'
import { saveDraftFn, type CharacterDoc, type CharacterResult, type SaveDraftInput } from '~/server/characters'
import { NO_CONNECTION_TEXT, refusalReason } from '~/components/sheet/refusal-text'

// ---- Rules the steps share ------------------------------------------------------------------------

export const ABILITIES: { id: AbilityId; label: string }[] = [
  { id: 'might', label: 'Might' },
  { id: 'agility', label: 'Agility' },
  { id: 'cunning', label: 'Cunning' },
  { id: 'presence', label: 'Presence' },
]

export type Age = BuilderInput['ageCategory']

/** Building_Your_Character.md "Age Categories": profession ranks, the per-profession cap and the benefit picks. */
export const AGE: Record<Age, { label: string; ranks: number; cap: number; picks: number; benefits: { id: string; label: string; text: string }[] }> = {
  young: {
    label: 'Young', ranks: 2, cap: 3, picks: 2,
    benefits: [
      { id: 'natural-learner', label: 'Natural Learner', text: 'Profession advancement requires 1 fewer challenge to complete (minimum 1).' },
      { id: 'fast-healer', label: 'Fast Healer', text: 'Wounds heal at twice the normal rate. A wound that would normally take 4 days to reduce by one rank instead takes 2 days.' },
      { id: 'young-and-foolish', label: 'Young and Foolish', text: 'When you accept a complication or negative aspect invocation, gain 1 extra DP beyond the normal amount.' },
    ],
  },
  adult: { label: 'Adult', ranks: 4, cap: 3, picks: 0, benefits: [] },
  elderly: {
    label: 'Elderly', ranks: 5, cap: 4, picks: 1,
    benefits: [
      { id: 'wisdom-of-experience', label: 'Wisdom of Experience', text: 'Choose one of your starting professions. When making skill checks with this profession, you may reroll any 1s on your dice (this does not trigger complications).' },
      { id: 'deep-knowledge', label: 'Deep Knowledge', text: 'Start with a rank 3 aspect related to accumulated knowledge, such as "Living Encyclopedia of Ancient History" or "Knows Every Herb in the Forest".' },
      { id: 'frail-body-sharp-mind', label: 'Frail Body, Sharp Mind', text: 'Start with the aspect "Frail" at rank 3. It can only be invoked negatively, and gives the normal DP when you do.' },
    ],
  },
}

/** The builder as the draft row holds it before steps 2–5 are filled: what step 1 creates. */
export function newBuilder(id: string, at: string, step1: Pick<BuilderInput, 'name' | 'pronouns' | 'dream' | 'portrait'>): BuilderInput {
  return {
    id, at, ...step1, description: '', motivation: '',
    raceId: '', subraceId: null, kinChoices: {},
    // Partial until step 3 assigns all four (a saved draft may hold an incomplete builder; createCharacter refuses it).
    dice: {} as Record<AbilityId, 4 | 6>,
    ageCategory: 'adult', ageBenefits: [], createdAspects: ['', ''], professions: [], bloodmarkLevel: 0,
  }
}

// ---- Shared form pieces -------------------------------------------------------------------------

export const labelClass = 'text-ui font-medium text-foreground'
export const selectClass =
  'h-11 w-full rounded-md border border-input bg-surface px-3 font-sans text-base text-foreground md:text-ui disabled:cursor-not-allowed disabled:opacity-50'

/** A labelled control with an optional hint under it. */
export function Field({ label, htmlFor, hint, children }: { label: ReactNode; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className="text-meta text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ---- Steps --------------------------------------------------------------------------------------

export const STEPS = ['Dream', 'Kin & culture', 'Vitals', 'Professions', 'Aspects', 'Talents', 'Gear'] as const
export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const toStep = (value: unknown): StepNumber => {
  const n = Math.trunc(Number(value))
  return (n >= 1 && n <= STEPS.length ? n : 1) as StepNumber
}

const named = (s: string) => s.trim().toLowerCase()
const count = (n: number) => (n === 1 ? 'one' : n === 2 ? 'two' : String(n))

/** What stops the player leaving `step` with Continue, in plain words. Empty when the step is complete. */
export function stepProblems(step: StepNumber, builder: BuilderInput): string[] {
  const problems: string[] = []
  const age = AGE[builder.ageCategory]
  switch (step) {
    case 1:
      if (!builder.name.trim()) problems.push('Give the character a name.')
      break
    case 2: {
      const race = getCatalogue().races.get(builder.raceId)
      if (!race) {
        problems.push('Choose a race.')
        break
      }
      const subrace = race.subraces.find((s) => s.id === builder.subraceId)
      if (race.subraces.length > 0 && !subrace) problems.push('Choose a subrace.')
      for (const c of [...race.choices, ...(subrace?.choices ?? [])]) if (!builder.kinChoices[c.id]) problems.push(`Choose ${c.title}.`)
      break
    }
    case 3: {
      const dice = ABILITIES.map((a) => builder.dice[a.id])
      const sixes = dice.filter((d) => d === 6).length
      const fours = dice.filter((d) => d === 4).length
      if (sixes !== 2 || fours !== 2) problems.push(`Assign exactly two d6 and two d4 (now ${sixes} d6 and ${fours} d4).`)
      if (builder.ageBenefits.length !== age.picks) problems.push(`Choose ${count(age.picks)} ${age.label.toLowerCase()} benefit${age.picks === 1 ? '' : 's'}.`)
      if (builder.ageBenefits.includes('deep-knowledge') && !builder.deepKnowledgeAspect?.trim()) problems.push('Write the Deep Knowledge aspect.')
      break
    }
    case 4: {
      const rows = builder.professions
      const total = rows.reduce((n, p) => n + p.rank, 0)
      if (rows.length === 0) problems.push('Add at least one profession.')
      if (rows.some((p) => !p.name.trim())) problems.push('Name every profession.')
      if (new Set(rows.map((p) => named(p.name))).size !== rows.length) problems.push('Two professions have the same name.')
      if (rows.some((p) => p.rank < 1)) problems.push('Every profession needs at least 1 rank.')
      if (rows.some((p) => p.rank > age.cap)) problems.push(`No profession may have more than ${age.cap} ranks.`)
      if (total !== age.ranks) problems.push(`Profession ranks must add up to ${age.ranks} (now ${total}).`)
      if (builder.ageBenefits.includes('wisdom-of-experience') && !rows.some((p) => p.name.trim() && named(p.name) === named(builder.ageBenefitProfession ?? '')))
        problems.push('Choose the profession Wisdom of Experience applies to.')
      break
    }
    case 5:
      if (builder.createdAspects.some((a) => !a.trim())) problems.push('Write both aspects.')
      break
  }
  return problems
}

/** The highest step the step bar may jump to: every step before it is complete. */
export function reachableStep(builder: BuilderInput): StepNumber {
  for (let s = 1; s < STEPS.length; s++) if (stepProblems(s as StepNumber, builder).length > 0) return s as StepNumber
  return STEPS.length as StepNumber
}

const PLACEHOLDER = '·'

/**
 * The character this builder makes, with placeholders for the parts the earlier steps have not reached yet
 * (professions, written aspects, unfinished dice or age picks), so steps 3–5 can show the engine's HP, heart die,
 * speed, starting XP and granted aspects before the builder is complete. Null until a race and its choices are made.
 */
export function sketchCharacter(builder: BuilderInput): Character | null {
  const age = AGE[builder.ageCategory]
  const dice = ABILITIES.map((a) => builder.dice[a.id])
  const diceOk = dice.filter((d) => d === 6).length === 2 && dice.filter((d) => d === 4).length === 2
  const benefitsOk = builder.ageBenefits.length === age.picks
  const benefits = benefitsOk ? builder.ageBenefits : age.benefits.slice(0, age.picks).map((b) => b.id)
  const [first, ...rest] = age.ranks > age.cap ? [age.cap, age.ranks - age.cap] : [age.ranks]
  const filled: BuilderInput = {
    ...builder,
    dice: diceOk ? builder.dice : { might: 6, agility: 6, cunning: 4, presence: 4 },
    ageBenefits: benefits,
    deepKnowledgeAspect: builder.deepKnowledgeAspect?.trim() || PLACEHOLDER,
    ageBenefitProfession: `${PLACEHOLDER}0`,
    professions: [first, ...rest].map((rank, i) => ({ name: `${PLACEHOLDER}${i}`, rank })),
    createdAspects: [PLACEHOLDER, PLACEHOLDER],
  }
  try {
    return createCharacter(filled, getCatalogue())
  } catch (error) {
    if (error instanceof RuleError) return null
    throw error
  }
}

// ---- The hook -----------------------------------------------------------------------------------

export const SAVE_DELAY_MS = 600

export type SaveStatus =
  | { kind: 'saved' }
  | { kind: 'saving' }
  /** Changed on screen, waiting for the pause before saving. */
  | { kind: 'unsaved' }
  /** The last save failed; `text` says why. The next change (or `flush`) tries again. */
  | { kind: 'failed'; text: string }

export type DraftPreview = {
  /** The character the engine computes from the draft; null while the builder is incomplete. */
  character: Character | null
  /** Pending actions the rules now refuse (ruling 8), in pending order. */
  invalid: { action: ClientAction; code: RuleErrorCode; message: string }[]
  /** Why `createCharacter` refuses the builder; null when it accepts it. */
  builderError: { code: RuleErrorCode; message: string } | null
}

export type UseDraft = {
  id: string
  builder: BuilderInput
  pending: ClientAction[]
  /** The revision of the last successful save. */
  revision: number
  status: SaveStatus
  preview: DraftPreview
  /** Changes steps 1–5. Saved after a pause. */
  update(change: Partial<BuilderInput> | ((builder: BuilderInput) => BuilderInput)): void
  /** Changes the step 6–7 actions (B1b). Saved after a pause. */
  setPending(change: ClientAction[] | ((pending: ClientAction[]) => ClientAction[])): void
  /** Saves now. Resolves with the saved document, or null when the save failed (`status` says why). */
  flush(): Promise<CharacterDoc | null>
  /** Set while a navigation away from the builder is held because unsaved changes failed to save. */
  leaving: { stay(): void; leave(): void } | null
}

const isResult = (r: unknown): r is CharacterResult => typeof r === 'object' && r !== null && typeof (r as { ok?: unknown }).ok === 'boolean'

export function computePreview(builder: BuilderInput, pending: ClientAction[]): DraftPreview {
  const draft: DraftState = { schemaVersion: 1, draft: true, builder, pending }
  try {
    const { character, invalid } = previewDraft(draft, getCatalogue())
    const byId = new Map(pending.map((a) => [a.id, a]))
    return {
      character,
      invalid: invalid.map((i) => ({ action: byId.get(i.actionId)!, code: i.error.code, message: i.error.message })),
      builderError: null,
    }
  } catch (error) {
    if (!(error instanceof RuleError)) throw error
    return { character: null, invalid: [], builderError: { code: error.code, message: error.message } }
  }
}

// ---- The saver (pure; the hook below wraps it for React) ------------------------------------------

/** What a draft holds besides its id: steps 1–5 and the pending step 6–7 actions. */
export type DraftContent = { builder: BuilderInput; pending: ClientAction[] }

/** One change made on this screen, kept until it saves so it can be reapplied to another tab's draft after a conflict. */
type Edit = (content: DraftContent) => DraftContent

export type DraftSnapshot = DraftContent & { revision: number; status: SaveStatus }

export type DraftSaver = {
  snapshot(): DraftSnapshot
  subscribe(listener: () => void): () => void
  /** Applies a change on screen and saves it after `SAVE_DELAY_MS`. */
  edit(change: Edit): void
  /** True while a change made here has not saved. */
  dirty(): boolean
  flush(): Promise<CharacterDoc | null>
  dispose(): void
}

const contentOf = (doc: CharacterDoc): DraftContent => {
  if (!doc.state.draft) throw new Error('useDraft needs a draft')
  return { builder: doc.state.builder, pending: doc.state.pending }
}

/** `save` is `saveDraftFn`; a call that rejects is a failed request. */
export function createDraftSaver(initial: CharacterDoc, save: (input: SaveDraftInput) => Promise<unknown>): DraftSaver {
  let saved = initial
  // The changes made here since the last save, oldest first; the screen shows them applied to `saved`.
  let edits: Edit[] = []
  let shown = contentOf(initial)
  let status: SaveStatus = { kind: 'saved' }
  let snap: DraftSnapshot = { ...shown, revision: saved.revision, status }
  let running: Promise<CharacterDoc | null> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()

  const emit = (next: SaveStatus = status) => {
    status = next
    snap = { ...shown, revision: saved.revision, status }
    for (const l of listeners) l()
  }

  async function send(): Promise<CharacterDoc | null> {
    let retriedConflict = false
    while (edits.length > 0) {
      const sent = edits.length
      emit({ kind: 'saving' })
      let result: unknown
      try {
        result = await save({ characterId: initial.id, revision: saved.revision, ...shown })
      } catch {
        result = null
      }
      if (!isResult(result) || (!result.ok && result.status >= 500)) {
        emit({ kind: 'failed', text: NO_CONNECTION_TEXT })
        return null
      }
      if (result.ok) {
        // The server holds what was sent; changes made during the request stay on screen and go next.
        saved = result.character
        edits = edits.slice(sent)
        retriedConflict = false
        continue
      }
      if (result.code === 'conflict' && result.character?.state.draft) {
        // Another tab saved first. Its draft is the truth; this screen's unsaved changes go on top of it and are sent
        // again, once. A second conflict shows the rebased draft and waits for Retry (or the next change).
        saved = result.character
        shown = edits.reduce((content, e) => e(content), contentOf(saved))
        if (!retriedConflict) {
          retriedConflict = true
          continue
        }
      }
      emit({ kind: 'failed', text: `Not saved: ${refusalReason(result.code, result.message)}` })
      return null
    }
    emit({ kind: 'saved' })
    return saved
  }

  const flush = (): Promise<CharacterDoc | null> => {
    if (timer) clearTimeout(timer)
    timer = null
    // One save at a time: a flush during a save waits for it, then saves whatever changed meanwhile.
    const run = (running ?? Promise.resolve(null)).then(() => send())
    running = run
    void run.finally(() => {
      if (running === run) running = null
    })
    return run
  }

  return {
    snapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    edit(change) {
      edits.push(change)
      shown = change(shown)
      emit({ kind: 'unsaved' })
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    dirty: () => edits.length > 0,
    flush,
    dispose() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}

// ---- The hook -----------------------------------------------------------------------------------

export function useDraft(initial: CharacterDoc): UseDraft {
  const save = useServerFn(saveDraftFn)
  const saveRef = useRef(save)
  saveRef.current = save
  const [saver] = useState(() => createDraftSaver(initial, (data) => saveRef.current({ data })))
  const { builder, pending, revision, status } = useSyncExternalStore(saver.subscribe, saver.snapshot, saver.snapshot)

  const update = useCallback<UseDraft['update']>(
    (change) => saver.edit((d) => ({ ...d, builder: typeof change === 'function' ? change(d.builder) : { ...d.builder, ...change } })),
    [saver],
  )
  const setPending = useCallback<UseDraft['setPending']>(
    (change) => saver.edit((d) => ({ ...d, pending: typeof change === 'function' ? change(d.pending) : change })),
    [saver],
  )

  // Leaving the builder (any navigation to another path, or closing the tab) is held while a change is unsaved:
  // a site link waits for the save, and stays blocked, asking, when it fails. Step changes stay on this path.
  const shouldBlockFn = useCallback<ShouldBlockFn>(
    async ({ current, next }) => current.pathname !== next.pathname && saver.dirty() && (await saver.flush()) === null,
    [saver],
  )
  const enableBeforeUnload = useCallback(() => saver.dirty(), [saver])
  const blocker = useBlocker({ shouldBlockFn, enableBeforeUnload, withResolver: true })
  const leaving = blocker.status === 'blocked' ? { stay: blocker.reset, leave: blocker.proceed } : null

  // A phone that switches away mid-pause still saves.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && saver.dirty()) void saver.flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      saver.dispose()
    }
  }, [saver])

  const preview = useMemo(() => computePreview(builder, pending), [builder, pending])

  return { id: initial.id, builder, pending, revision, status, preview, update, setPending, flush: saver.flush, leaving }
}
