// What a proposal card line means, in one place: how a line is checked against a draft, whether it is already in the
// draft, and how Apply writes it. The server's settle step and the browser's Apply both call these, so a line the
// server keeps is a line the browser reads the same way. Pure: no React, no D1, no `cloudflare:workers`.
//
// A card's lines are taken in order onto a working copy of the draft; a refused line is skipped and changes nothing, so a
// line is checked against the draft plus the lines before it. Builder lines (steps 1–5) are checked here against the
// rules the builder's own controls follow; talent and gear lines (steps 6–7) become one stamped pending action each and
// are checked by the engine itself (`applyAction` on the sketch character), so a price or a refusal is never decided here.
import { ulid } from 'ulid'
import { applyAction } from '@heartrush/rules-engine/actions'
import { price, xpRemaining } from '@heartrush/rules-engine/pricing'
import type { PlayChoice, PlayTalent } from '@heartrush/rules-engine/catalogue'
import { RuleError, type AbilityId, type BuilderInput, type Character, type ClientAction, type RuleErrorCode } from '@heartrush/rules-engine/types'
import { getCatalogue, RULES_ORIGIN, rulebookUrl, type PlayCatalogue } from '~/catalogue'
import { AGE, sketchPreview, stepProblems, type DraftContent, type StepNumber } from '~/components/builder/draft-rules'
import { refusalReason } from '~/components/sheet/refusal-text'
import type { CardLine, Json, StoredCard, StoredLine, TurnDecision, TurnOption, Turn } from './schema'

// ---- Types ----------------------------------------------------------------------------------------

/** A line as the run returns it, or as stored: `id`, `before` and `at` are stamped by `settleTurn`. */
export type LineInput = CardLine & { id?: string; before?: unknown; at?: string }

/** `changed` is the one refusal that is not a rules code: the player edited the field after the card was made. */
export type LineCode = RuleErrorCode | 'changed'
export type LineProblem = { code: LineCode; reason: string }
export type LineCheck = { ok: true } | ({ ok: false } & LineProblem)

/** Derived on every render, never stored. */
export type LineState = 'applied' | 'open' | 'changed'

export type AppliedCard = {
  builder: BuilderInput
  pending: ClientAction[]
  /** The lines this call wrote (a line already in the draft is neither here nor in `refused`). */
  applied: StoredLine[]
  refused: ({ line: StoredLine } & LineProblem)[]
  /** The lowest builder step among `applied`; null when nothing was written. */
  earliestStep: StepNumber | null
}

/** What the server stores for a turn, before it adds the message id, time and run id. */
export type SettledTurn = { text: string; decision: TurnDecision | null; card: StoredCard | null }

type BuilderKind = 'name' | 'pronouns' | 'dream' | 'kin' | 'kinChoice' | 'die' | 'age' | 'bloodmarkLevel' | 'professions' | 'aspect'
type ActionKind = 'talent' | 'weapon' | 'armor' | 'shield' | 'item'
type LineOf<K extends CardLine['kind']> = Extract<LineInput, { kind: K }>
type BuilderLine = LineOf<BuilderKind>
type ActionLine = LineOf<ActionKind>

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1)
const rule = (code: RuleErrorCode, message?: string): LineProblem => ({ code, reason: refusalReason(code, message) })
/** A refusal whose sentence is already written for the player (the `stepProblems` words). */
const sentence = (code: RuleErrorCode, text: string): LineProblem => ({ code, reason: lowerFirst(text.replace(/\.$/, '')) })

/** Two values are the same when their JSON is, with surrounding spaces ignored in text. Values are built with a fixed key order. */
const canon = (v: unknown): string => JSON.stringify(v ?? null, (_k, x) => (typeof x === 'string' ? x.trim() : x))

// ---- Builder lines (steps 1–5): each is typed against the field it writes ----------------------------

type Spec<L extends BuilderLine> = {
  step: StepNumber
  /** What the line sets the field to. */
  value(line: L): unknown
  /** What the field holds in `builder`; null when empty. */
  current(builder: BuilderInput, line: L): unknown
  /** Why the line cannot be written onto `builder`, or null. */
  check(line: L, builder: BuilderInput): LineProblem | null
  write(line: L, builder: BuilderInput): BuilderInput
  /** A value in the words of "now ‹value›". */
  show(value: unknown): string
}

const quoted = (v: unknown) => (v === null || v === undefined ? 'empty' : `“${String(v)}”`)

type TextKind = 'name' | 'pronouns' | 'dream'
const textSpec = (field: TextKind, noun: string): Spec<LineOf<TextKind>> => ({
  step: 1,
  value: (l) => l.text.trim(),
  current: (b) => b[field].trim() || null,
  check: (l) => (l.text.trim() ? null : rule('bad_action', `The ${noun} is empty`)),
  write: (l, b) => ({ ...b, [field]: l.text.trim() }),
  show: quoted,
})

const sixesAndFours = (dice: Partial<Record<AbilityId, 4 | 6>>) => {
  const all = Object.values(dice)
  return { sixes: all.filter((d) => d === 6).length, fours: all.filter((d) => d === 4).length }
}

/** The benefit pick as the builder holds it: Deep Knowledge's aspect and Wisdom's profession exist only with their benefit. */
const ageValue = (category: BuilderInput['ageCategory'], benefits: string[], deep: string | undefined | null, profession: string | undefined | null) => ({
  ageCategory: category,
  ageBenefits: [...benefits].sort(),
  deepKnowledgeAspect: benefits.includes('deep-knowledge') ? deep?.trim() || null : null,
  ageBenefitProfession: benefits.includes('wisdom-of-experience') ? profession?.trim() || null : null,
})

const professionsOf = (rows: { name: string; rank: number }[]) => rows.map((p) => ({ name: p.name.trim(), rank: p.rank }))

/** `createCharacter` refuses more than three starting professions; `stepProblems(4)` does not say so. */
const MAX_PROFESSIONS = 3

const BUILDER: { [K in BuilderKind]: Spec<LineOf<K>> } = {
  name: textSpec('name', 'name'),
  pronouns: textSpec('pronouns', 'pronouns'),
  dream: textSpec('dream', 'dream'),

  kin: {
    step: 2,
    value: (l) => ({ raceId: l.raceId, subraceId: l.subraceId }),
    current: (b) => (b.raceId ? { raceId: b.raceId, subraceId: b.subraceId } : null),
    check(l) {
      const race = getCatalogue().races.get(l.raceId)
      if (!race) return rule('unknown_race')
      if (l.subraceId !== null && !race.subraces.some((s) => s.id === l.subraceId)) return rule('unknown_subrace')
      return null
    },
    write(l, b) {
      const race = getCatalogue().races.get(l.raceId)!
      // As StepKin does: a new race clears the kin choices; a new subrace of the same race keeps only the race's own answers.
      const keep = new Set(race.choices.map((c) => c.id))
      const kinChoices =
        l.raceId !== b.raceId ? {} : l.subraceId === b.subraceId ? b.kinChoices : Object.fromEntries(Object.entries(b.kinChoices).filter(([k]) => keep.has(k)))
      return { ...b, raceId: l.raceId, subraceId: l.subraceId, kinChoices }
    },
    show(v) {
      const k = v as { raceId: string; subraceId: string | null } | null
      if (!k) return 'empty'
      const race = getCatalogue().races.get(k.raceId)
      const subrace = race?.subraces.find((s) => s.id === k.subraceId)
      return race ? (subrace ? `${race.title} / ${subrace.title}` : race.title) : k.raceId
    },
  },

  kinChoice: {
    step: 2,
    value: (l) => l.optionId,
    current: (b, l) => b.kinChoices[l.choiceId] ?? null,
    check(l, b) {
      const race = getCatalogue().races.get(b.raceId)
      if (!race) return rule('kin_choice', 'Choose a kin first')
      const subrace = race.subraces.find((s) => s.id === b.subraceId)
      const choice: PlayChoice | undefined = [...race.choices, ...(subrace?.choices ?? [])].find((c) => c.id === l.choiceId)
      if (!choice) return rule('kin_choice', `${l.choiceId} is not a choice for this kin`)
      if (choice.kind === 'options') {
        return choice.options.some((o) => o.id === l.optionId) ? null : rule('kin_choice', `${choice.id}: choose one of ${choice.options.map((o) => o.id).join(', ')}`)
      }
      const talent = getCatalogue().talents.get(l.optionId)
      if (!talent || (choice.tradition !== null && talent.tradition !== choice.tradition))
        return rule('kin_choice', `${choice.id}: ${l.optionId} is not a${choice.tradition ? ` ${choice.tradition}` : ''} catalogue talent`)
      return null
    },
    write: (l, b) => ({ ...b, kinChoices: { ...b.kinChoices, [l.choiceId]: l.optionId } }),
    show: (v) => (v === null ? 'empty' : String(v)),
  },

  die: {
    step: 3,
    value: (l) => l.die,
    current: (b, l) => b.dice[l.ability] ?? null,
    check(l, b) {
      const { sixes, fours } = sixesAndFours({ ...b.dice, [l.ability]: l.die })
      return sixes > 2 || fours > 2 ? rule('invalid_dice', `That would make ${sixes} d6 and ${fours} d4`) : null
    },
    write: (l, b) => ({ ...b, dice: { ...b.dice, [l.ability]: l.die } }),
    show: (v) => (v === null ? 'empty' : `d${v}`),
  },

  age: {
    step: 3,
    value: (l) => ageValue(l.ageCategory, l.ageBenefits, l.deepKnowledgeAspect, l.ageBenefitProfession),
    current: (b) => ageValue(b.ageCategory, b.ageBenefits, b.deepKnowledgeAspect, b.ageBenefitProfession),
    check(l) {
      const age = AGE[l.ageCategory]
      const allowed = new Set(age.benefits.map((x) => x.id))
      const v = ageValue(l.ageCategory, l.ageBenefits, l.deepKnowledgeAspect, l.ageBenefitProfession)
      if (l.ageBenefits.length !== age.picks || new Set(l.ageBenefits).size !== l.ageBenefits.length || l.ageBenefits.some((x) => !allowed.has(x)))
        return rule('invalid_age_benefits')
      if (l.ageBenefits.includes('deep-knowledge') && !v.deepKnowledgeAspect) return rule('invalid_age_benefits', 'Deep Knowledge needs its aspect')
      return null
    },
    write(l, b) {
      const { deepKnowledgeAspect: _d, ageBenefitProfession: _w, ...rest } = b
      const v = ageValue(l.ageCategory, l.ageBenefits, l.deepKnowledgeAspect, l.ageBenefitProfession)
      return {
        ...rest,
        ageCategory: l.ageCategory,
        ageBenefits: [...l.ageBenefits],
        ...(v.deepKnowledgeAspect ? { deepKnowledgeAspect: v.deepKnowledgeAspect } : {}),
        ...(v.ageBenefitProfession ? { ageBenefitProfession: v.ageBenefitProfession } : {}),
      }
    },
    show: (v) => (v ? `${AGE[(v as { ageCategory: keyof typeof AGE }).ageCategory].label.toLowerCase()}` : 'empty'),
  },

  bloodmarkLevel: {
    step: 3,
    value: (l) => l.level,
    current: (b) => b.bloodmarkLevel,
    check: (l) => (Number.isInteger(l.level) && l.level >= 0 ? null : rule('bad_action', 'The bloodmark level must be a whole number, 0 or more')),
    write: (l, b) => ({ ...b, bloodmarkLevel: l.level }),
    show: (v) => String(v),
  },

  professions: {
    step: 4,
    value: (l) => professionsOf(l.professions),
    current: (b) => (b.professions.length ? professionsOf(b.professions) : null),
    check(l, b) {
      const next = BUILDER.professions.write(l, b)
      const problems = stepProblems(4, next)
      if (l.professions.length > MAX_PROFESSIONS) problems.push(`At most ${MAX_PROFESSIONS} professions.`)
      if (l.professions.some((p) => !Number.isInteger(p.rank))) problems.push('Every rank must be a whole number.')
      return problems.length ? sentence('invalid_professions', problems.map((p) => lowerFirst(p.replace(/\.$/, ''))).join('; ')) : null
    },
    write: (l, b) => ({ ...b, professions: professionsOf(l.professions) }),
    show: (v) => (v ? (v as { name: string; rank: number }[]).map((p) => `${p.name} ${p.rank}`).join(', ') : 'empty'),
  },

  aspect: {
    step: 5,
    value: (l) => l.text.trim(),
    current: (b, l) => b.createdAspects[l.slot - 1]?.trim() || null,
    check: (l) => (l.text.trim() ? null : rule('bad_action', 'The aspect is empty')),
    write: (l, b) => ({ ...b, createdAspects: (l.slot === 1 ? [l.text.trim(), b.createdAspects[1]] : [b.createdAspects[0], l.text.trim()]) as [string, string] }),
    show: quoted,
  },
}

const isBuilderLine = (line: LineInput): line is BuilderLine => line.kind in BUILDER
const spec = (line: BuilderLine) => BUILDER[line.kind] as unknown as Spec<BuilderLine>

// ---- Talent and gear lines (steps 6–7): one pending action each ------------------------------------

const ACTION_STEP: Record<ActionKind, StepNumber> = { talent: 6, weapon: 7, armor: 7, shield: 7, item: 7 }

/** Elemental Affinity is the one talent whose text lets it be taken again (`TalentCatalogue.tsx` reads the same sentence). */
const repeatable = (t: PlayTalent) => /may take this talent multiple times/i.test(t.body)

/** The stamped action a line adds; a talent purchase is the one `talentBuyAction` builds. */
function actionFor(line: ActionLine, id: string, at: string): ClientAction {
  switch (line.kind) {
    case 'talent': {
      const entry = getCatalogue().talents.get(line.catalogueId)
      // An unknown id is refused by the engine (`not_found`) when this action is applied; the category only names the purchase.
      return {
        kind: 'xp:buy',
        purchase: `talent:${entry?.category ?? 'combat'}`,
        talent: { catalogueId: line.catalogueId, ...(line.attunementElement !== null ? { attunementElement: line.attunementElement } : {}) },
        id,
        at,
      }
    }
    case 'weapon':
      return {
        kind: 'gear:weapon:add',
        weapon: { name: line.name.trim(), size: line.size, damageType: line.damageType, attackType: line.attackType, reach: line.reach, misc: 0, wielded: line.wielded },
        id,
        at,
      }
    case 'armor': return { kind: 'gear:armor:set', armor: { name: line.name.trim(), weight: line.weight, misc: 0, worn: true }, id, at }
    case 'shield': return { kind: 'gear:shield:set', shield: { name: line.name.trim(), weight: line.weight, misc: 0, worn: true }, id, at }
    case 'item': return { kind: 'gear:item:add', item: { name: line.name.trim(), slots: line.slots, quantity: line.quantity, notes: line.notes.trim() }, id, at }
  }
}

const isActionLine = (line: LineInput): line is ActionLine => line.kind in ACTION_STEP

/** Why steps 6–7 cannot be priced or edited yet: the sketch character needs a kin and all its choices. */
function notReady(builder: BuilderInput): LineProblem {
  const text = getCatalogue().races.has(builder.raceId) ? 'Finish the kin choices first' : 'Choose a kin first'
  return { code: 'not_ready', reason: lowerFirst(text) }
}

/** The engine's verdict on adding `action` to the sketch of `working`, or null when it accepts it. */
function checkAction(line: ActionLine, action: ClientAction, working: DraftContent): LineProblem | null {
  const sketch = sketchPreview(working.builder, working.pending)
  if (!sketch) return notReady(working.builder)
  if (line.kind === 'talent') {
    const entry = getCatalogue().talents.get(line.catalogueId)
    if (entry && !repeatable(entry) && sketch.talents.some((t) => t.catalogueId === entry.id)) return rule('bad_action', `${entry.title} is already known`)
  }
  if (line.kind !== 'talent' && !(line.name.trim())) return rule('bad_action', 'The name is empty')
  try {
    applyAction(sketch, action, getCatalogue())
    return null
  } catch (error) {
    if (!(error instanceof RuleError)) throw error
    return rule(error.code, error.message)
  }
}

// ---- The public functions -------------------------------------------------------------------------

/** The builder step a line belongs to (a card heading links to it). */
export const lineStep = (line: LineInput): StepNumber => (isBuilderLine(line) ? spec(line).step : ACTION_STEP[line.kind as ActionKind])

/**
 * Whether the draft already holds the line: a builder line when the field has the line's value, a talent or gear line when
 * `pending` holds the action with the line's id. A builder line whose field now holds neither its `before` nor its own value
 * was changed in the builder after the card was made. Everything else is open.
 */
export function lineState(line: LineInput, draft: DraftContent): LineState {
  if (!isBuilderLine(line)) return line.id !== undefined && draft.pending.some((a) => a.id === line.id) ? 'applied' : 'open'
  const s = spec(line)
  const current = canon(s.current(draft.builder, line))
  if (current === canon(s.value(line))) return 'applied'
  if (line.before !== undefined && current !== canon(line.before)) return 'changed'
  return 'open'
}

/** Ids and times for lines that are checked before they are stamped; the engine only needs them non-empty. */
const UNSTAMPED_AT = '1970-01-01T00:00:00.000Z'

type Run = { checks: LineCheck[]; working: DraftContent; wrote: boolean[] }

function run(lines: readonly LineInput[], draft: DraftContent): Run {
  let working: DraftContent = { builder: draft.builder, pending: [...draft.pending] }
  const checks: LineCheck[] = []
  const wrote: boolean[] = []
  lines.forEach((line, i) => {
    const state = lineState(line, draft)
    wrote.push(false)
    if (state === 'applied') return void checks.push({ ok: true })
    if (state === 'changed' && isBuilderLine(line)) {
      const s = spec(line)
      return void checks.push({ ok: false, code: 'changed', reason: `changed in the builder since this card was made (now ${s.show(s.current(draft.builder, line))})` })
    }
    let problem: LineProblem | null
    if (isActionLine(line)) {
      const action = actionFor(line, line.id ?? `card-line-${i}`, line.at ?? UNSTAMPED_AT)
      problem = checkAction(line, action, working)
      if (!problem) working = { builder: working.builder, pending: [...working.pending, action] }
    } else {
      const s = spec(line as BuilderLine)
      problem = s.check(line as BuilderLine, working.builder)
      if (!problem) working = { builder: s.write(line as BuilderLine, working.builder), pending: working.pending }
    }
    wrote[i] = !problem
    checks.push(problem ? { ok: false, ...problem } : { ok: true })
  })
  return { checks, working, wrote }
}

/** Each line checked in card order against `draft` plus the lines before it. A line already in the draft is ok. */
export const checkCard = (lines: readonly LineInput[], draft: DraftContent): LineCheck[] => run(lines, draft).checks

/** What Apply writes: the open lines that pass, in order. Lines the rules refuse, or the builder changed, come back in `refused`. */
export function applyCard(lines: readonly StoredLine[], draft: DraftContent): AppliedCard {
  const { checks, working, wrote } = run(lines, draft)
  const applied = lines.filter((_, i) => wrote[i])
  const refused = lines.flatMap((line, i) => {
    const c = checks[i]!
    return c.ok ? [] : [{ line, code: c.code, reason: c.reason }]
  })
  const steps = applied.map(lineStep)
  return { builder: working.builder, pending: working.pending, applied, refused, earliestStep: steps.length ? (Math.min(...steps) as StepNumber) : null }
}

// ---- Settling a turn (server) ---------------------------------------------------------------------

/** `url` is `origin + path` itself or something under it (`#anchor`, `?query`, `/more`). */
const isUnder = (url: string, path: string): boolean => {
  const base = RULES_ORIGIN + path
  return url.startsWith(base) && (url.length === base.length || '#?/'.includes(url[base.length]!))
}

/** The talent is not known (unless its text allows it again) and `price` accepts it within the XP left. */
function canBuy(sketch: Character, talent: PlayTalent): boolean {
  if (!repeatable(talent) && sketch.talents.some((t) => t.catalogueId === talent.id)) return false
  try {
    return price(sketch, `talent:${talent.category}`, { talent: { tradition: talent.tradition, elements: talent.elements, attunementLevel: talent.attunementLevel } }) <= xpRemaining(sketch)
  } catch (error) {
    if (error instanceof RuleError) return false
    throw error
  }
}

/** The option as it is stored, or null when it is dropped (see `settleTurn`). */
function settleOption(option: TurnOption, draft: DraftContent, catalogue: PlayCatalogue): TurnOption | null {
  if (!option.link.startsWith(`${RULES_ORIGIN}/`)) return null
  const ref = option.ref
  if (!ref) return option
  let path: string
  if (ref.kind === 'race') {
    const race = catalogue.races.get(ref.raceId)
    if (!race || (ref.subraceId !== null && !race.subraces.some((s) => s.id === ref.subraceId))) return null
    path = race.path
  } else {
    const talent = catalogue.talents.get(ref.catalogueId)
    if (!talent) return null
    // Whether the draft could buy it now is the engine's answer on the sketch character; before a kin exists there is no price to judge.
    const sketch = sketchPreview(draft.builder, draft.pending)
    if (sketch && !canBuy(sketch, talent)) return null
    path = talent.path
  }
  return isUnder(option.link, path) ? option : { ...option, link: rulebookUrl(path) }
}

/**
 * The turn as the server stores it. Options naming an unknown race, subrace or talent, a talent the draft cannot buy now, or
 * a link outside the rules site are dropped (a catalogue option with a link elsewhere on the site gets its catalogue link);
 * with no option left the decision is null. Lines `checkCard` refuses are dropped; with no line left the card is null. Each
 * kept line gets an `id` and its field's value in the stored draft as `before`; talent and gear lines get the settle time
 * as `at`, and their `id` becomes the pending action's id on Apply.
 */
export function settleTurn(turn: Turn, draft: DraftContent, catalogue: PlayCatalogue, stamp: { newId?: () => string; now?: string } = {}): SettledTurn {
  const newId = stamp.newId ?? ulid
  const now = stamp.now ?? new Date().toISOString()

  const options = turn.decision?.options.flatMap((o) => settleOption(o, draft, catalogue) ?? []) ?? []
  const decision = turn.decision && options.length > 0 ? { ...turn.decision, options } : null

  let card: StoredCard | null = null
  if (turn.card) {
    const checks = checkCard(turn.card.lines, draft)
    const lines = turn.card.lines.flatMap((line, i): StoredLine[] => {
      if (!checks[i]!.ok) return []
      const id = newId()
      return [isBuilderLine(line) ? { ...line, id, before: (spec(line).current(draft.builder, line) ?? null) as Json } : { ...line, id, at: now }]
    })
    if (lines.length > 0) card = { lines }
  }
  return { text: turn.message, decision, card }
}
