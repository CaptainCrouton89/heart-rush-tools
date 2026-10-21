import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import type { Action, Character, StoredState } from '@heartrush/rules-engine/types'
import { hinderGain } from '@heartrush/rules-engine/reducers/combat'
import { Button } from '@heartrush/ui/components/button'
import { getCatalogue } from '~/catalogue'
import { listEventsFn, type EventSummary, type ListEventsResult } from '~/server/characters'
import { Section } from './SheetLayout'
import { refusalReason } from './refusal-text'

const ABILITY: Record<string, string> = { might: 'Might', agility: 'Agility', cunning: 'Cunning', presence: 'Presence' }

/**
 * Plain words for one action, as the undo chip and the History list show it. `state` (the sheet's character) names the
 * aspect an invocation used — the action carries only its id — and gives a hinder's nominal gain (rank, +1 with Young
 * and Foolish). `dpChange` (the history's record of what the event did to DP) gives the gain exactly; without it — the undo
 * chip, whose `state` is the one just after the hinder — the nominal gain is exact unless the hinder reached the 10 DP cap.
 */
export function describeAction(a: Action, state?: StoredState, dpChange?: number): string {
  const character = state && !state.draft ? state : undefined
  const aspect = (id: string) => character?.aspects.find((x) => x.id === id)
  switch (a.kind) {
    case 'damage': return a.amount >= 10 ? `Took ${a.amount}, wound added` : `Took ${a.amount} damage`
    case 'heal': return `Healed ${a.amount}`
    case 'setHp': return `Set HP to ${a.value}`
    case 'wound:add': return `Added a wound of rank ${a.wound.rank}`
    case 'wound:edit': return 'Edited a wound'
    case 'wound:remove': return 'Removed a wound'
    case 'wound:treat': return `Treated a wound (roll ${a.medicineRoll})`
    case 'condition:set': return a.level === 0 ? 'Removed a condition' : 'Changed a condition'
    case 'condition:custom': return a.level === 0 ? 'Removed a condition' : 'Changed a custom condition'
    case 'ability:use': return 'Used an ability'
    case 'ability:reset': return 'Reset an ability'
    case 'rush:set': return `Rush points set to ${a.value}`
    case 'dp:set': return `DP set to ${a.value}`
    case 'round:set': return `Round set to ${a.value}`
    case 'heartDie:spend': return `Spent the heart die (${a.effect})`
    case 'heartDie:set': return `Heart die set to d${a.value}`
    case 'nextRound': {
      const step = a.suffocation
      if (!step) return 'Next round'
      return `Next round · Suffocating: ${step.kind === 'drop' ? `heart die d${step.from} → d${step.to}` : step.kind === 'damage' ? `${step.amount} damage` : 'unconscious'}`
    }
    case 'endFight': return 'Ended the fight'
    case 'shortRest': return 'Short rest'
    case 'longRest': return a.successful ? 'Long rest' : 'Long rest (failed)'
    case 'startSession': return 'Started a session'
    case 'xp:award': return `Awarded ${a.amount} XP`
    case 'xp:buy': return a.target?.ability ? `Bought a larger ${ABILITY[a.target.ability]} die` : a.talent ? `Bought ${getCatalogue().talents.get(a.talent.catalogueId)?.title ?? 'a talent'}` : 'Spent XP'
    case 'bloodmark:award': return 'Awarded a bloodmark'
    case 'bloodmark:pick': return `Took ${a.ability.title}`
    case 'gear:weapon:add': return `Added ${a.weapon.name}`
    case 'gear:item:add': return `Added ${a.item.name}`
    case 'gear:weapon:edit': case 'gear:weapon:remove': case 'gear:wield': case 'gear:armor:set': case 'gear:shield:set':
    case 'gear:wear': case 'gear:item:edit': case 'gear:item:remove': case 'gear:coins:set':
      return 'Changed gear'
    case 'aspect:edit': case 'aspect:remove': return 'Changed an aspect'
    case 'aspect:invoke': { const x = aspect(a.aspectId); return `Used ${x ? `"${x.text}"` : 'an aspect'}: −${a.dp} DP` }
    case 'aspect:hinder': {
      const x = aspect(a.aspectId)
      if (!x || !character) return 'Hindered by an aspect'
      if (dpChange !== undefined) return `Hindered by "${x.text}": +${dpChange} DP`
      return character.play.dp < 10 ? `Hindered by "${x.text}": +${hinderGain(character, x)} DP` : `Hindered by "${x.text}": DP to 10`
    }
    case 'profession:add': return `Added ${a.profession.name}`
    case 'profession:edit': case 'profession:remove': case 'profession:challenge': case 'profession:practice':
    case 'profession:mission': case 'profession:advance':
      return 'Changed a profession'
    case 'identity:set': return 'Edited identity'
    case 'notes:set': return 'Edited notes'
    case 'raceEffects:set': return 'Changed race effects'
    case 'attunement:set': return 'Changed attunements'
    case 'undo': return 'Undo'
    case 'restore': return 'Restored'
  }
}

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * Mount it with `key={characterId}` so another character's rows never show. The last 20 events, newest first (`listEventsFn`), refetched whenever `refreshKey` changes (the sheet passes the
 * document's revision and whether a write is pending, so it refetches once each write has saved). Only `topEventId` (the
 * latest event that can still be undone) gets an **Undo** control; an undone event is struck through; an undo
 * event names what it undid.
 */
export function HistoryList({
  characterId,
  character,
  refreshKey,
  canEdit,
  onUndo,
}: {
  characterId: string
  /** The sheet as shown, so an aspect invocation's line names the aspect. */
  character: Character
  refreshKey: string
  canEdit: boolean
  onUndo: (eventId: string) => void
}) {
  const list = useServerFn(listEventsFn)
  const [result, setResult] = useState<ListEventsResult | null>(null)
  // The refreshKey the shown result was fetched for: Undo is offered only on a result that is current.
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    list({ data: { characterId } }).then(
      (r) => { if (current) { setResult(r); setFetchedFor(refreshKey); setFailed(false) } },
      () => { if (current) setFailed(true) },
    )
    return () => { current = false }
  }, [list, characterId, refreshKey])

  const byId = new Map<string, EventSummary>(result?.ok ? result.events.map((e) => [e.id, e]) : [])
  const label = (e: EventSummary) => {
    if (e.action.kind !== 'undo') return describeAction(e.action, character, e.dpChange)
    const of = byId.get(e.action.of)
    return of ? `Undid: ${describeAction(of.action, character, of.dpChange)}` : 'Undid an earlier change'
  }

  return (
    <Section title="History">
      {failed ? (
        <p className="text-ui text-muted-foreground">History could not be loaded — no connection.</p>
      ) : !result ? (
        <p className="text-ui text-muted-foreground">Loading…</p>
      ) : !result.ok ? (
        <p className="text-ui text-muted-foreground">History could not be loaded: {refusalReason(result.code, result.message)}.</p>
      ) : result.events.length === 0 ? (
        <p className="text-ui text-muted-foreground">No changes yet.</p>
      ) : (
        <ol className="flex flex-col">
          {result.events.map((e) => (
            <li key={e.id} className="flex min-h-11 items-center gap-3 border-b border-border last:border-b-0">
              <span className={`min-w-0 flex-1 text-ui ${e.undone ? 'text-muted-foreground line-through' : ''}`}>{label(e)}</span>
              <time dateTime={e.createdAt} className="shrink-0 text-meta text-muted-foreground tabular-nums">
                {time(e.createdAt)}
              </time>
              {canEdit && fetchedFor === refreshKey && e.id === result.topEventId && (
                <Button size="compact" type="button" variant="line" className="shrink-0" onClick={() => onUndo(e.id)}>
                  Undo
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}
