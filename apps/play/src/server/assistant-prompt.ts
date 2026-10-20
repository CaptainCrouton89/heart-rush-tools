// The creation assistant's prompt (design "The prompt"): ten numbered rules built only from the stored draft, the stored chat and the
// play catalogue. Pure like `ai-prompts.ts`: no D1, no runtime, no `cloudflare:workers`, so the tests import it under Node.
// Nothing the browser says about the character reaches it; the caller loads `character.state` and `builder_chat.messages`.
import { RULES_LOOKUP } from '@heartrush/content/agent-lookup'
import { maxHp, speed } from '@heartrush/rules-engine/derived'
import { price, xpRemaining } from '@heartrush/rules-engine/pricing'
import type { PlayChoice, PlayTalent } from '@heartrush/rules-engine/catalogue'
import type { ClientAction } from '@heartrush/rules-engine/types'
import { RuleError } from '@heartrush/rules-engine/types'
import { RULES_ORIGIN, type PlayCatalogue } from '~/catalogue'
import { lineState } from '~/assistant/card'
import type { AssistantMessage, StoredLine, StoredMessage } from '~/assistant/schema'
import { AGE, sketchPreview, stepProblems, STEPS, type DraftContent, type StepNumber } from '~/components/builder/draft-rules'

/** Older messages are dropped, oldest first, once the chat text passes this many characters. */
export const CHAT_LIMIT = 30_000

const page = (path: string) => `${RULES_ORIGIN}${path}`

// ---- 1–5: who the assistant is and how it behaves --------------------------------------------------

const ROLE = `You help one player make a Heart Rush character, a few decisions at a time. You never change the character: every change is a line on a proposal card that the player applies.`

const NOT_DND = `Heart Rush is not D&D. Creation facts, each with the rules page to link:
- A character has two d6 and two d4 across Might, Agility, Cunning and Presence (${page('/player/building-your-character')}).
- There are no classes. Characters grow through Paths and bloodmarks (${page('/player/paths')}).
- There are no spell slots and no spell levels. Magic is elemental attunement (the Elemental Affinity talent, ${page('/player/talents/elemental-affinity')}) plus cantrips and elemental talents bought with XP (${page('/player/magic')}).
- Talents are bought with XP: a character at bloodmark 0 starts with 5 XP, and the first combat or noncombat talent normally costs 3 XP. The prices in the catalogue below are the only prices to quote (${page('/player/experience-advancement')}).
- Aspects are double-edged: they help, and they cause trouble the player is paid Destiny Points to accept.
- The dream is hard, chosen by the player, and drives play. It can be lost, and then the player chooses a new purpose.
When the player uses a D&D idea that does not exist here, say so plainly and name the Heart Rush equivalent with its link.`

const TURN = `How a turn works:
- Ask one decision per turn, or one tight group that belongs together, like race and subrace. Give 2 to 4 real options, each with one sentence on how it plays and its rules link. The app adds a "You decide" button; never write one.
- Speak only to what the player sent. Follow what the player leads with, then what follows from it, until every step 1 to 5 is complete. The steps need not go in order.
- A direct statement ("Centaur lancer, d6 Might and Agility", "just give me something legal for the rest") is followed at once: put everything it states on a card, fill in what the rules then force (two d6 and two d4 mean the other two dice are d4), and ask only about what is still open.
- When the player reopens an earlier choice, say what it changes further on (a race change clears the subrace and the kin choices).
- Put changes to more than one builder step on one card only when the player stated them themselves ("Centaur lancer, d6 Might and Agility" is kin and dice: both go on the card) or asked you to decide the rest. Otherwise one step per card.`

const READING = `Reading the player:
- Enjoys mechanics: show every option with its numbers and offer See all; never hide options to keep things simple.
- Enjoys story: stay out of their writing; turn their words into mechanical choices and quote their words as the reason.
- Starts from a single hook (an ability, a look): start there, find what in Heart Rush delivers it, and say plainly if Heart Rush has no such thing.
- Looking for an idea: offer a few different directions from Heart Rush's kin and its hard, self-chosen dream, then narrow from the reaction.
- New to roleplaying games: explain terms. From D&D: explain where Heart Rush differs. Knows Heart Rush: be terse.
- A hurried player gets fewer options and more proposals. If they mention a party or the GM's pitch, ask about it and fit the character to it.
- "You pick", one-word answers and skipped questions mean decide more and propose. Long answers, follow-up questions and rejected options mean more options and more say for the player.`

const NEVER = `What you never write:
- The name, pronouns, dream, aspects or backstory, unless the player asks. When asked, offer 2 to 4 drafts as the options of a decision, then put the chosen one on a card.
- A line that changes a field listed below as "written by the player: do not change", unless the player's latest message asks for that change.
- The starting bloodmark level stays 0 unless the player says their table agreed another.
- Gear is a short proposed kit from the Weapons, Cantrips & Armor page (${page('/player/weapons-cantrips-armor')}) and the Equipment & Gear page (${page('/player/equipment-gear')}), with a note to agree starting gear with the GM. Coins, paths, bloodmark abilities, description and motivation are not on cards.`

const LOOKUP = `${RULES_LOOKUP}
- Link a rule with the \`web:\` URL of the search result. For a catalogue entry the link is ${RULES_ORIGIN} followed by its path, shown below.
- If a lookup finds nothing, say you could not find that rule. Never fill the gap from D&D, another game or invention.`

// ---- 7: the draft now ------------------------------------------------------------------------------

const written = (label: string, value: string | undefined) => (value && value.trim() ? [`- ${label}: written by the player: do not change: "${value.trim()}"`] : [`- ${label}: empty`])

/** A pending step 6–7 action in the words a prompt needs; the sheet's `describeAction` says only "Changed gear" for armor. */
function describePending(a: ClientAction, catalogue: PlayCatalogue): string {
  switch (a.kind) {
    case 'xp:buy': return a.talent ? `bought talent ${catalogue.talents.get(a.talent.catalogueId)?.title ?? a.talent.catalogueId}${a.talent.attunementElement ? ` (attuned to ${a.talent.attunementElement})` : ''}` : `bought ${a.purchase}`
    case 'gear:weapon:add': return `weapon ${a.weapon.name} (${a.weapon.size}, ${a.weapon.damageType}, ${a.weapon.attackType}${a.weapon.reach ? ', reach' : ''}${a.weapon.wielded ? ', wielded' : ''})`
    case 'gear:armor:set': return `armor ${a.armor.name ?? ''} (${a.armor.weight ?? ''})`
    case 'gear:shield:set': return `shield ${a.shield.name ?? ''} (${a.shield.weight ?? ''})`
    case 'gear:item:add': return `item ${a.item.name} x${a.item.quantity}`
    default: return a.kind
  }
}

function draftSection(draft: DraftContent, catalogue: PlayCatalogue): string {
  const b = draft.builder
  const race = catalogue.races.get(b.raceId)
  const subrace = race?.subraces.find((s) => s.id === b.subraceId)
  const step = (n: StepNumber) => {
    const problems = stepProblems(n, b)
    return `- Step ${n} ${STEPS[n - 1]}: ${problems.length ? problems.join(' ') : 'complete'}`
  }
  const lines = [
    'The draft now (read from the saved character):',
    ...written('Name', b.name),
    ...written('Pronouns', b.pronouns),
    ...written('Dream', b.dream),
    `- Kin: ${race ? `${race.title} (${race.id})` : 'not chosen'}${subrace ? `, subrace ${subrace.title} (${subrace.id})` : ''}`,
    `- Kin choices made: ${Object.keys(b.kinChoices).length ? Object.entries(b.kinChoices).map(([c, o]) => `${c} = ${o}`).join('; ') : 'none'}`,
    `- Dice: ${(['might', 'agility', 'cunning', 'presence'] as const).map((a) => `${a} ${b.dice[a] ? `d${b.dice[a]}` : 'not set'}`).join(', ')}`,
    `- Age: ${b.ageCategory}; benefits ${b.ageBenefits.length ? b.ageBenefits.join(', ') : 'none'}; profession for Wisdom of Experience ${b.ageBenefitProfession?.trim() || 'none'}`,
    ...written('Deep Knowledge aspect', b.deepKnowledgeAspect),
    `- Starting bloodmark level: ${b.bloodmarkLevel}`,
    `- Professions: ${b.professions.length ? b.professions.map((p) => `${p.name} ${p.rank}`).join(', ') : 'none'}`,
    ...written('Aspect 1', b.createdAspects[0]),
    ...written('Aspect 2', b.createdAspects[1]),
    ...([1, 2, 3, 4, 5] as StepNumber[]).map(step),
    `- Pending talents and gear: ${draft.pending.length ? draft.pending.map((a) => describePending(a, catalogue)).join('; ') : 'none'}`,
  ]
  const sketch = sketchPreview(b, draft.pending)
  lines.push(
    sketch
      ? `- With this kin: HP ${maxHp(sketch)}, speed ${speed(sketch)}, heart die d${sketch.hp.heartDieCurrent}, XP ${sketch.xp.awarded} in total and ${xpRemaining(sketch)} left to spend`
      : '- No numbers yet: they appear once a kin and all its choices are chosen',
  )
  return lines.join('\n')
}

// ---- 8: the catalogue ------------------------------------------------------------------------------

const choiceText = (c: PlayChoice) => (c.kind === 'options' ? `${c.id}: ${c.options.map((o) => o.id).join(' / ')}` : `${c.id}: talent of ${c.tradition ?? 'any tradition'}`)

function kinSection(catalogue: PlayCatalogue): string {
  const rows = [...catalogue.races.values()].map((r) => {
    const subraces = r.subraces.length ? r.subraces.map((s) => `${s.id} ${s.title}${s.choices.length ? ` [choices ${s.choices.map(choiceText).join('; ')}]` : ''}`).join(', ') : 'none'
    return `${r.id} | ${r.title} | ${r.size ?? 'size not stated'} | ${r.path} | subraces: ${subraces} | choices: ${r.choices.length ? r.choices.map(choiceText).join('; ') : 'none'}`
  })
  return ['Kin (id | title | size | path | subraces | choices). Copy ids exactly:', ...rows].join('\n')
}

function priceNote(sketch: ReturnType<typeof sketchPreview>, t: PlayTalent): string {
  if (!sketch) return 'price after kin is chosen'
  if (sketch.talents.some((k) => k.catalogueId === t.id) && !/may take this talent multiple times/i.test(t.body)) return 'already known'
  try {
    const cost = price(sketch, `talent:${t.category}`, { talent: { tradition: t.tradition, elements: t.elements, attunementLevel: t.attunementLevel } })
    return cost > xpRemaining(sketch) ? `${cost} XP (more than the ${xpRemaining(sketch)} XP left)` : `${cost} XP`
  } catch (error) {
    if (error instanceof RuleError) return `not buyable now (${error.code})`
    throw error
  }
}

function talentSection(draft: DraftContent, catalogue: PlayCatalogue): string {
  const sketch = sketchPreview(draft.builder, draft.pending)
  const rows = [...catalogue.talents.values()].map(
    (t) => `${t.id} | ${t.title} | ${t.category} | ${t.tradition ?? 'no tradition'} | ${t.elements.length ? t.elements.join(' and ') : 'no element'} | ${priceNote(sketch, t)} | ${t.path}`,
  )
  return ['Talents (id | title | category | tradition | elements | price for this draft | path). Copy ids exactly; read a talent\'s text from its path with the lookup:', ...rows].join('\n')
}

function ageSection(): string {
  return ['Age categories (profession ranks, benefit ids):', ...(Object.entries(AGE) as [string, (typeof AGE)['young']][]).map(([id, a]) =>
    `- ${id}: ${a.ranks} profession ranks, at most ${a.cap} in one profession, ${a.picks} benefit${a.picks === 1 ? '' : 's'}${a.benefits.length ? `: ${a.benefits.map((x) => x.id).join(', ')}` : ''}`)].join('\n')
}

// ---- 9: the chat so far ----------------------------------------------------------------------------

const LINE_OMIT = new Set(['id', 'before', 'at', 'reason'])

function describeLine(line: StoredLine, draft: DraftContent): string {
  const fields = Object.entries(line).filter(([k]) => !LINE_OMIT.has(k)).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
  const state = lineState(line, draft)
  return `    - ${fields} — ${line.reason} [${state === 'applied' ? 'applied' : state === 'changed' ? 'changed in the builder since' : 'not applied'}]`
}

function describeMessage(m: StoredMessage, draft: DraftContent): string {
  if (m.role === 'player') return `Player: ${m.text}`
  const a: AssistantMessage = m
  const out = [`Assistant: ${a.text}`]
  if (a.decision) out.push(`  (asked: ${a.decision.question} Options: ${a.decision.options.map((o) => o.label).join(' | ')})`)
  if (a.card) out.push('  (proposed card:', ...a.card.lines.map((l) => describeLine(l, draft)), '  )')
  return out.join('\n')
}

function chatSection(messages: readonly StoredMessage[], draft: DraftContent): string {
  const rendered = messages.map((m) => describeMessage(m, draft))
  let start = 0
  let size = rendered.reduce((n, r) => n + r.length + 2, 0)
  while (size > CHAT_LIMIT && start < rendered.length - 1) size -= rendered[start++]!.length + 2
  return [
    'The chat so far (oldest first):',
    ...(start > 0 ? ['(earlier messages were omitted)'] : []),
    ...(rendered.length ? rendered.slice(start) : ['(no messages yet)']),
  ].join('\n\n')
}

const OUTPUT = `Fill message, decision and card as the schema describes. Every id in ref, raceId, subraceId, catalogueId, choiceId and optionId must be copied from the catalogue above. Reply to the player's last message and nothing else.`

/** The whole prompt for one turn. `messages` already ends with the player's message this run answers. */
export function assistantPrompt(draft: DraftContent, messages: readonly StoredMessage[], catalogue: PlayCatalogue): string {
  const numbered = [
    `1. ${ROLE}`,
    `2. ${NOT_DND}`,
    `3. ${TURN}`,
    `4. ${READING}`,
    `5. ${NEVER}`,
    `6. ${LOOKUP}`,
    `7. ${draftSection(draft, catalogue)}`,
    `8. The catalogue.\n${kinSection(catalogue)}\n\n${talentSection(draft, catalogue)}\n\n${ageSection()}`,
    `9. ${chatSection(messages, draft)}`,
    `10. ${OUTPUT}`,
  ]
  return numbered.join('\n\n')
}
