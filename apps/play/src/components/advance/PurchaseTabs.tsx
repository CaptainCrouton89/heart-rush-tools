// The non-talent purchases on `/advance`: ability die, max HP, aspects, destiny and path. Every price and every
// refusal comes from the engine's `price()` through `quote` (INV-DERIVED); each Buy dispatches one `xp:buy`.
import { useId, useState } from 'react'
import { aspectRankCap, dieCap } from '@heartrush/rules-engine/pricing'
import type { AbilityId, Character, PurchaseKind, Target } from '@heartrush/rules-engine/types'
import { Input } from '@heartrush/ui/components/input'
import { PATHS, PATHS_BY_ID, resolveRef, rulebookUrl, type PlayCatalogue } from '~/catalogue'
import type { ActionDraft, Outcome } from '~/components/sheet/use-character'
import type { Derived } from '~/server/characters'
import { BuyRow, quote } from './BuyRow'

export type PurchaseTabProps = {
  character: Character
  derived: Derived
  catalogue: PlayCatalogue
  dispatch: (action: ActionDraft) => Promise<Outcome>
}

const buy = (purchase: PurchaseKind, target?: Target, extra: { aspectText?: string } = {}): ActionDraft => ({
  kind: 'xp:buy', purchase, ...(target ? { target } : {}), ...extra,
})

const ABILITIES: { id: AbilityId; label: string }[] = [
  { id: 'might', label: 'Might' },
  { id: 'agility', label: 'Agility' },
  { id: 'cunning', label: 'Cunning' },
  { id: 'presence', label: 'Presence' },
]

/** "d6 → d8 for 8 XP" per ability; at the cap the row says so and offers nothing. */
export function DieTab({ character, dispatch }: PurchaseTabProps) {
  return (
    <ul className="flex flex-col">
      {ABILITIES.map(({ id, label }) => {
        const current = character.abilities[id].current
        const cap = dieCap(character, id)
        const q = quote(character, 'die', { ability: id })
        return (
          <BuyRow
            key={id}
            title={label}
            detail={
              current >= cap ? (
                <>d{current}, the largest {label} die {cap < 12 ? 'your kin allows' : 'there is'}</>
              ) : (
                <>
                  d{current} → d{current + 2}
                  {q.cost !== null && <> for {q.cost} XP</>}
                </>
              )
            }
            q={q}
            onBuy={() => void dispatch(buy('die', { ability: id }))}
          />
        )
      })}
    </ul>
  )
}

/** Max HP goes up 10 per purchase. */
export function HpTab({ character, derived, dispatch }: PurchaseTabProps) {
  const q = quote(character, 'hp')
  return (
    <ul className="flex flex-col">
      <BuyRow
        title="Max HP"
        detail={<>{derived.maxHp} → {derived.maxHp + 10}{q.cost !== null && <> for {q.cost} XP</>}</>}
        q={q}
        onBuy={() => void dispatch(buy('hp'))}
      />
    </ul>
  )
}

/** A new aspect starts at rank 1; each owned aspect can rank up to the cap. */
export function AspectsTab({ character, dispatch }: PurchaseTabProps) {
  const [text, setText] = useState('')
  const textId = useId()
  const newQ = quote(character, 'aspect:new')
  const cap = aspectRankCap(character)
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        <BuyRow
          title="New aspect"
          detail="Starts at rank 1"
          q={newQ}
          disabled={!text.trim()}
          onBuy={() => {
            void dispatch(buy('aspect:new', undefined, { aspectText: text.trim() })).then((o) => { if (o.status === 'saved') setText('') })
          }}
        >
          <label htmlFor={textId} className="sr-only">
            New aspect text
          </label>
          <Input id={textId} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write the aspect" className="h-11" />
        </BuyRow>
      </ul>
      <h3 className="eyebrow">Rank up</h3>
      {character.aspects.length === 0 ? (
        <p className="text-ui text-muted-foreground">No aspects yet.</p>
      ) : (
        <ul className="flex flex-col">
          {character.aspects.map((a) => {
            const q = quote(character, 'aspect:rank', { aspectId: a.id })
            return (
              <BuyRow
                key={a.id}
                title={a.text || 'Untitled aspect'}
                detail={a.rank >= cap ? <>Rank {a.rank}, the highest</> : <>Rank {a.rank} → {a.rank + 1}{a.honor ? ' · honor' : ''}</>}
                q={q}
                label="Rank up"
                onBuy={() => void dispatch(buy('aspect:rank', { aspectId: a.id }))}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** A destiny level on a talent the character has, once per talent. */
export function DestinyTab({ character, catalogue, dispatch }: PurchaseTabProps) {
  const talents = character.talents.filter((t) => !t.destiny)
  const done = character.talents.filter((t) => t.destiny)
  return (
    <div className="flex flex-col gap-4">
      {talents.length === 0 ? (
        <p className="text-ui text-muted-foreground">Every talent the character has already has its destiny level, or there are none yet.</p>
      ) : (
        <ul className="flex flex-col">
          {talents.map((t) => {
            const ref = resolveRef(catalogue.talents, t)
            const entry = ref.entry
            // The price depends on the talent's tradition (Gnome Handmagic destiny); the engine reads it from the catalogue.
            const target: Target = { talentId: t.id }
            const q = quote(character, 'destiny', { ...target, ...(entry ? { talent: { tradition: entry.tradition } } : {}) })
            return (
              <BuyRow
                key={t.id}
                title={<>{ref.title}{ref.unresolved && t.catalogueId && <span className="font-normal text-muted-foreground"> · no longer in the rulebook</span>}</>}
                detail={entry?.destiny ? <span className="line-clamp-2">{entry.destiny}</span> : t.category}
                q={q}
                onBuy={() => void dispatch(buy('destiny', target))}
              />
            )
          })}
        </ul>
      )}
      {done.length > 0 && (
        <p className="text-ui text-muted-foreground">With destiny: {done.map((t) => resolveRef(catalogue.talents, t).title).join(', ')}</p>
      )}
    </div>
  )
}

/** Paths.md: one path per character, then tiers 2–4. */
export function PathTab({ character, dispatch }: PurchaseTabProps) {
  const path = character.path
  if (path) {
    const known = PATHS_BY_ID.get(path.pathId)
    const q = quote(character, 'path:tier')
    return (
      <ul className="flex flex-col">
        <BuyRow
          title={known?.title ?? path.pathId}
          detail={path.tier >= 4 ? <>Tier {path.tier}, the top tier</> : <>Tier {path.tier} → {path.tier + 1}</>}
          q={q}
          label="Next tier"
          onBuy={() => void dispatch(buy('path:tier'))}
        >
          {known && <RulebookLink path={known.path} />}
        </BuyRow>
      </ul>
    )
  }
  return (
    <ul className="flex flex-col">
      {PATHS.map((p) => {
        const q = quote(character, 'path', { pathId: p.id })
        return (
          <BuyRow key={p.id} title={p.title} detail="Tier 1" q={q} label="Take path" onBuy={() => void dispatch(buy('path', { pathId: p.id }))}>
            <RulebookLink path={p.path} />
          </BuyRow>
        )
      })}
    </ul>
  )
}

function RulebookLink({ path }: { path: string }) {
  return (
    <a href={rulebookUrl(path)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 w-fit items-center text-ui text-primary underline underline-offset-4">
      Read in rulebook ↗
    </a>
  )
}
