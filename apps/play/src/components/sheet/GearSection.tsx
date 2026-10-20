import { Button } from '@heartrush/ui/components/button'
import { EditLink } from '~/components/edit/EditLink'
import { ARMOR_WEIGHTS, COINS, DAMAGE_TYPES, SHIELD_WEIGHTS, SIZES, SlotMeter, formatSlots } from '~/components/edit/GearEditor'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

const label = <T extends string>(options: readonly { value: T; label: string }[], value: T) => options.find((o) => o.value === value)?.label ?? value
const signed = (n: number) => (n > 0 ? ` +${n}` : n < 0 ? ` −${-n}` : '')

/**
 * The sheet's gear: the slot meter (`slotsUsed / slotCapacity`, from `derived`), weapons with Wield (one tap — the
 * engine keeps exactly one wielded weapon, so wielding one unwields the other), armor and shield with whether they
 * are worn, items with slots × quantity, and coins. Adding and changing gear is on `/characters/$id/edit`.
 */
export function GearSection({ character, derived, dispatch, canEdit }: SectionProps) {
  const { weapons, armor, shield, items, coins } = character.gear
  const coinLine = COINS.filter((c) => coins[c.id] > 0).map((c) => `${coins[c.id]} ${c.label.toLowerCase()}`)

  return (
    <Section title="Gear" action={canEdit && <EditLink block="gear" />}>
      <SlotMeter used={derived.slotsUsed} capacity={derived.slotCapacity} />

      <ul className="flex flex-col">
        {weapons.map((w) => (
          <li key={w.id} className="flex min-h-11 items-center gap-3 border-b border-border">
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui font-medium">
                {w.name || 'Unnamed weapon'}
                {signed(w.misc)}
              </p>
              <p className="truncate text-meta text-muted-foreground">
                {label(SIZES, w.size)} · {label(DAMAGE_TYPES, w.damageType)} · {w.attackType}
                {w.reach && ' · reach'}
              </p>
            </div>
            {canEdit ? (
              <Button
                type="button"
                variant={w.wielded ? 'secondary' : 'outline'}
                role="checkbox"
                aria-checked={w.wielded}
                aria-label={`Wield ${w.name || 'weapon'}`}
                className="h-11 shrink-0 px-3"
                onClick={() => void dispatch({ kind: 'gear:wield', weaponId: w.wielded ? null : w.id })}
              >
                {w.wielded ? '✓ Wielded' : 'Wield'}
              </Button>
            ) : (
              w.wielded && <span className="shrink-0 text-meta font-medium">wielded</span>
            )}
          </li>
        ))}
        {armor.weight !== 'none' && (
          <Piece name={armor.name || 'Armor'} detail={`${label(ARMOR_WEIGHTS, armor.weight)} armor${signed(armor.misc)}`} worn={armor.worn} />
        )}
        {shield.weight !== 'none' && (
          <Piece name={shield.name || 'Shield'} detail={`${label(SHIELD_WEIGHTS, shield.weight)} shield${signed(shield.misc)}`} worn={shield.worn} />
        )}
        {items.map((item) => (
          <li key={item.id} className="flex min-h-11 items-center gap-3 border-b border-border">
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui">
                {item.quantity !== 1 && <span className="tabular-nums">{item.quantity} × </span>}
                {item.name || 'Unnamed item'}
              </p>
              {item.notes && <p className="truncate text-meta text-muted-foreground">{item.notes}</p>}
            </div>
            <span className="shrink-0 text-meta text-muted-foreground tabular-nums">{formatSlots(item.slots * item.quantity)} slots</span>
          </li>
        ))}
      </ul>
      {weapons.length === 0 && armor.weight === 'none' && shield.weight === 'none' && items.length === 0 && (
        <p className="text-ui text-muted-foreground">No gear.</p>
      )}

      <p className="text-ui">
        <span className="text-muted-foreground">Coins </span>
        {coinLine.length ? coinLine.join(' · ') : 'none'}
      </p>
    </Section>
  )
}

function Piece({ name, detail, worn }: { name: string; detail: string; worn: boolean }) {
  return (
    <li className="flex min-h-11 items-center gap-3 border-b border-border">
      <div className="min-w-0 flex-1">
        <p className="truncate text-ui font-medium">{name}</p>
        <p className="truncate text-meta text-muted-foreground">{detail}</p>
      </div>
      <span className={worn ? 'shrink-0 text-meta font-medium' : 'shrink-0 text-meta text-muted-foreground'}>{worn ? 'worn' : 'carried'}</span>
    </li>
  )
}
