import { useId, useState } from 'react'
import type { BloodmarkKind, Character } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { Textarea } from '@heartrush/ui/components/textarea'
import type { ActionDraft, Outcome } from '~/components/sheet/use-character'
import { ELEMENTS, elementLabel } from './elements'

const KINDS: { value: BloodmarkKind; label: string }[] = [
  { value: 'specialization', label: 'Specialization' },
  { value: 'signature', label: 'Signature' },
  { value: 'mastery', label: 'Mastery' },
  { value: 'paragon', label: 'Paragon' },
]

/** The engine recognises Warcaster by a specialization titled "Warcaster" (`hasWarcaster`); this mirrors it to ask for the element. */
const isWarcaster = (kind: BloodmarkKind, title: string) => kind === 'specialization' && title.trim().toLowerCase() === 'warcaster'

const selectClass = 'h-11 w-full rounded-md border border-input bg-surface px-3 font-sans text-base text-foreground md:text-ui'

/**
 * Bloodmark abilities owed at the character's level (the engine's `bloodmarkPicksOwed`, from `derived`), and a form
 * that takes one: kind, typed title and text (no compiled bloodmark catalogue in v1). A Warcaster specialization
 * also asks for one of the nine elements, sent as `ability.element`; the engine adds the basic attunement.
 */
export function BloodmarkPicks({
  character,
  owed,
  dispatch,
}: {
  character: Character
  owed: Record<BloodmarkKind, number>
  dispatch: (action: ActionDraft) => Promise<Outcome>
}) {
  const open = KINDS.filter((k) => owed[k.value] > 0)
  const [kind, setKind] = useState<BloodmarkKind | ''>('')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [element, setElement] = useState('')
  const ids = useId()

  const fallback: BloodmarkKind | '' = open.length > 0 ? open[0].value : ''
  const chosen: BloodmarkKind | '' = kind !== '' && owed[kind] > 0 ? kind : fallback
  const warcaster = chosen !== '' && isWarcaster(chosen, title)
  const ready = chosen !== '' && title.trim() !== '' && (!warcaster || element !== '')

  const submit = () => {
    if (chosen === '' || !ready) return
    const ability = { kind: chosen, title: title.trim(), text: text.trim(), ...(warcaster ? { element } : {}) }
    void dispatch({ kind: 'bloodmark:pick', ability }).then((o) => {
      if (o.status !== 'saved') return
      setTitle('')
      setText('')
      setElement('')
      setKind('')
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ui">
        Bloodmark level <span className="font-semibold tabular-nums">{character.bloodmarks.level}</span>
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Picks owed">
        {KINDS.map((k) => (
          <li
            key={k.value}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-sm border px-2 text-meta ${owed[k.value] > 0 ? 'border-primary font-semibold text-primary' : 'border-border text-muted-foreground'}`}
          >
            {k.label} <span className="tabular-nums">{Math.max(0, owed[k.value])}</span> owed
          </li>
        ))}
      </ul>

      {open.length === 0 ? (
        <p className="text-ui text-muted-foreground">No bloodmark ability is owed at this level.</p>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-kind`} className="text-ui font-medium">Kind</label>
            <select id={`${ids}-kind`} className={selectClass} value={chosen} onChange={(e) => setKind(e.target.value as BloodmarkKind)}>
              {open.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-title`} className="text-ui font-medium">Ability name</label>
            <Input id={`${ids}-title`} className="h-11" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example: Warcaster" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-text`} className="text-ui font-medium">What it does</label>
            <Textarea id={`${ids}-text`} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {warcaster && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-element`} className="text-ui font-medium">Element to attune (basic)</label>
              <select id={`${ids}-element`} className={selectClass} value={element} onChange={(e) => setElement(e.target.value)} required>
                <option value="">Choose an element</option>
                {ELEMENTS.filter((el) => !character.attunements.some((a) => a.element.toLowerCase() === el)).map((el) => (
                  <option key={el} value={el}>{elementLabel(el)}</option>
                ))}
              </select>
              <p className="text-meta text-muted-foreground">Warcaster: elemental talents cost (elemental talents known) + 3 XP.</p>
            </div>
          )}
          <Button size="compact" variant="line-primary" type="submit" className="w-fit" disabled={!ready}>
            Take ability
          </Button>
        </form>
      )}

      {character.bloodmarks.abilities.length > 0 && (
        <>
          <h3 className="eyebrow">Taken</h3>
          <ul className="flex flex-col">
            {character.bloodmarks.abilities.map((a) => (
              <li key={a.id} className="flex flex-col border-b border-border py-2 last:border-b-0">
                <span className="text-control font-semibold">
                  {a.title} <span className="text-meta font-normal text-muted-foreground">· {a.kind}, level {a.grantedAtLevel}</span>
                </span>
                {a.text && <span className="text-ui whitespace-pre-line text-muted-foreground">{a.text}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
