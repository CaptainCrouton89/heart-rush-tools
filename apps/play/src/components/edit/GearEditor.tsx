import { useState, type FormEvent } from 'react'
import { slotCapacity, slotsUsed } from '@heartrush/rules-engine/derived'
import type {
  ArmorWeight, AttackType, Character, Coins, DamageType, ShieldWeight, Size, Weapon,
} from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import type { PlayCatalogue } from '~/catalogue'
import { WriteIn } from '~/components/builder/write-in'
import type { ActionDraft } from '~/components/sheet/use-character'
import { Check, CommitNumber, CommitText, Field, Picker, numberInputProps, parseNumber } from './fields'

export const SIZES: readonly { value: Size; label: string }[] = [
  { value: 'H', label: 'Heavy' },
  { value: 'L', label: 'Light' },
  { value: 'UL', label: 'Ultralight' },
]
export const DAMAGE_TYPES: readonly { value: DamageType; label: string }[] = [
  { value: 'B', label: 'Bludgeoning' },
  { value: 'S', label: 'Slashing' },
  { value: 'P', label: 'Piercing' },
]
const ATTACK_TYPES: readonly { value: AttackType; label: string }[] = [
  { value: 'melee', label: 'Melee' },
  { value: 'ranged', label: 'Ranged' },
  { value: 'thrown', label: 'Thrown' },
  { value: 'whip', label: 'Whip' },
]
export const ARMOR_WEIGHTS: readonly { value: ArmorWeight; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'L', label: 'Light' },
  { value: 'M', label: 'Medium' },
  { value: 'H', label: 'Heavy' },
]
export const SHIELD_WEIGHTS: readonly { value: ShieldWeight; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'L', label: 'Light' },
  { value: 'H', label: 'Heavy' },
]
export const COINS: readonly { id: keyof Coins; label: string }[] = [
  { id: 'iron', label: 'Iron' },
  { id: 'obol', label: 'Obol' },
  { id: 'lire', label: 'Lire' },
  { id: 'ducat', label: 'Ducat' },
  { id: 'crown', label: 'Crown' },
]

/** "6", "6.4" or "0.05": the slot count as the engine has it, without floating-point noise (0.1 + 0.2). */
export const formatSlots = (n: number): string => String(Number(n.toFixed(6)))

/** "Slots 6 / 9", and how far over capacity the character is. */
export function SlotMeter({ used, capacity }: { used: number; capacity: number }) {
  const over = used > capacity
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-baseline justify-between gap-3 font-sans text-control tabular-nums">
        <span>
          Slots <span className="font-semibold">{formatSlots(used)}</span> / {capacity}
        </span>
        {over && <span className="text-ui font-medium text-warning">{formatSlots(used - capacity)} over</span>}
      </p>
      <div
        role="meter"
        aria-label="Slots used"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={used}
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className={over ? 'h-full bg-warning' : 'h-full bg-primary'} style={{ width: `${Math.min(100, (used / capacity) * 100)}%` }} />
      </div>
    </div>
  )
}

/**
 * Edits a character's gear: weapons (size, damage type and attack type pickers, reach, misc bonus, wielded), armor,
 * shield, items (slots × quantity) and coins, under the slot meter (`slotsUsed / slotCapacity` from the engine).
 * Each change is one `gear:*` action handed to `onChange`; the editor does not know whether the caller dispatches it
 * (the edit page) or appends it to a draft's pending list (the builder). `value` is the character as the caller
 * shows it, so the editor reflects each change once the caller applies it. `catalogue` is accepted for the
 * builder's step-7 contract; gear has no catalogue yet, so nothing reads it.
 */
export function GearEditor({ value, onChange }: { value: Character; catalogue: PlayCatalogue; onChange: (action: ActionDraft) => unknown }) {
  const gear = value.gear
  return (
    <div className="flex flex-col gap-6">
      <SlotMeter used={slotsUsed(value)} capacity={slotCapacity(value)} />

      <div className="flex flex-col gap-3">
        <h3 className="eyebrow">Weapons</h3>
        {gear.weapons.length === 0 ? (
          <p className="text-ui text-muted-foreground">No weapons.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {gear.weapons.map((w) => (
              <WeaponRow key={w.id} weapon={w} onChange={onChange} />
            ))}
          </ul>
        )}
        <AddWeapon onChange={onChange} />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="eyebrow">Armor</h3>
        <WriteIn field="armor" className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <Field label="Armor name">
            {(id) => <CommitText id={id} value={gear.armor.name} placeholder="Leather" onCommit={(name) => onChange({ kind: 'gear:armor:set', armor: { name } })} />}
          </Field>
          <Field label="Misc">
            {(id) => <CommitNumber id={id} kind="signed" value={gear.armor.misc} onCommit={(misc) => onChange({ kind: 'gear:armor:set', armor: { misc } })} />}
          </Field>
        </WriteIn>
        <Picker label="Armor weight" value={gear.armor.weight} options={ARMOR_WEIGHTS} onChange={(weight) => onChange({ kind: 'gear:armor:set', armor: { weight } })} />
        <div>
          <Check checked={gear.armor.worn} onChange={(worn) => onChange({ kind: 'gear:wear', piece: 'armor', worn })}>
            Worn
          </Check>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="eyebrow">Shield</h3>
        <WriteIn field="shield" className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <Field label="Shield name">
            {(id) => <CommitText id={id} value={gear.shield.name} onCommit={(name) => onChange({ kind: 'gear:shield:set', shield: { name } })} />}
          </Field>
          <Field label="Misc">
            {(id) => <CommitNumber id={id} kind="signed" value={gear.shield.misc} onCommit={(misc) => onChange({ kind: 'gear:shield:set', shield: { misc } })} />}
          </Field>
        </WriteIn>
        <Picker label="Shield weight" value={gear.shield.weight} options={SHIELD_WEIGHTS} onChange={(weight) => onChange({ kind: 'gear:shield:set', shield: { weight } })} />
        <div>
          <Check checked={gear.shield.worn} onChange={(worn) => onChange({ kind: 'gear:wear', piece: 'shield', worn })}>
            Worn
          </Check>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="eyebrow">Items</h3>
        {gear.items.length === 0 ? (
          <p className="text-ui text-muted-foreground">No items.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {gear.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0">
                <WriteIn field={`gear:${item.id}`} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-end gap-2">
                  <Field label="Item">
                    {(id) => (
                      <CommitText id={id} value={item.name} onCommit={(name) => onChange({ kind: 'gear:item:edit', item: { id: item.id, name } })} />
                    )}
                  </Field>
                  <Field label="Slots">
                    {(id) => (
                      <CommitNumber id={id} kind="decimal" value={item.slots} onCommit={(slots) => onChange({ kind: 'gear:item:edit', item: { id: item.id, slots } })} />
                    )}
                  </Field>
                  <Field label="Qty">
                    {(id) => (
                      <CommitNumber id={id} value={item.quantity} onCommit={(quantity) => onChange({ kind: 'gear:item:edit', item: { id: item.id, quantity } })} />
                    )}
                  </Field>
                </WriteIn>
                <div className="flex items-end gap-2">
                  <Field label="Notes" className="flex-1">
                    {(id) => (
                      <CommitText id={id} value={item.notes} onCommit={(notes) => onChange({ kind: 'gear:item:edit', item: { id: item.id, notes } })} />
                    )}
                  </Field>
                  <Button size="compact" type="button" variant="line" aria-label={`Remove ${item.name || 'item'}`} onClick={() => onChange({ kind: 'gear:item:remove', itemId: item.id })}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddItem onChange={onChange} />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="eyebrow">Coins</h3>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {COINS.map((c) => (
            <Field key={c.id} label={c.label}>
              {(id) => <CommitNumber id={id} value={gear.coins[c.id]} onCommit={(n) => onChange({ kind: 'gear:coins:set', coins: { [c.id]: n } })} />}
            </Field>
          ))}
        </div>
      </div>
    </div>
  )
}

function WeaponRow({ weapon: w, onChange }: { weapon: Weapon; onChange: (action: ActionDraft) => unknown }) {
  const edit = (patch: Partial<Omit<Weapon, 'id'>>) => onChange({ kind: 'gear:weapon:edit', weapon: { id: w.id, ...patch } })
  return (
    <li className="flex flex-col gap-3 border-b border-border pb-4 last:border-b-0">
      <WriteIn field={`gear:${w.id}`} className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <Field label="Weapon">{(id) => <CommitText id={id} value={w.name} onCommit={(name) => edit({ name })} />}</Field>
        <Field label="Misc">{(id) => <CommitNumber id={id} kind="signed" value={w.misc} onCommit={(misc) => edit({ misc })} />}</Field>
      </WriteIn>
      <Picker label="Size" value={w.size} options={SIZES} onChange={(size) => edit({ size })} />
      <Picker label="Damage type" value={w.damageType} options={DAMAGE_TYPES} onChange={(damageType) => edit({ damageType })} />
      <Picker label="Attack type" value={w.attackType} options={ATTACK_TYPES} onChange={(attackType) => edit({ attackType })} />
      <div className="flex flex-wrap gap-2">
        <Check checked={w.wielded} onChange={(on) => onChange({ kind: 'gear:wield', weaponId: on ? w.id : null })}>
          Wielded
        </Check>
        <Check checked={w.reach} onChange={(reach) => edit({ reach })}>
          Reach
        </Check>
        <Button size="compact" type="button" variant="line" className="ml-auto" aria-label={`Remove ${w.name || 'weapon'}`} onClick={() => onChange({ kind: 'gear:weapon:remove', weaponId: w.id })}>
          Remove
        </Button>
      </div>
    </li>
  )
}

type NewWeapon = Omit<Weapon, 'id' | 'misc'> & { misc: string }
const BLANK_WEAPON: NewWeapon = { name: '', size: 'L', damageType: 'S', attackType: 'melee', reach: false, misc: '0', wielded: false }

function AddWeapon({ onChange }: { onChange: (action: ActionDraft) => unknown }) {
  const [draft, setDraft] = useState<NewWeapon | null>(null)
  if (!draft) {
    return (
      <Button size="compact" type="button" variant="line" className="self-start" onClick={() => setDraft(BLANK_WEAPON)}>
        Add weapon
      </Button>
    )
  }
  const misc = parseNumber(draft.misc, 'signed')
  const set = (patch: Partial<NewWeapon>) => setDraft({ ...draft, ...patch })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim() || misc === null) return
    onChange({ kind: 'gear:weapon:add', weapon: { ...draft, name: draft.name.trim(), misc } })
    setDraft(null)
  }
  return (
    <form onSubmit={submit} aria-label="New weapon" className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <Field label="New weapon">
          {(id) => <Input id={id} autoFocus value={draft.name} placeholder="Bow" onChange={(e) => set({ name: e.target.value })} className="h-11" />}
        </Field>
        <Field label="Misc">
          {(id) => <Input id={id} {...numberInputProps('signed')} value={draft.misc} aria-invalid={misc === null} onChange={(e) => set({ misc: e.target.value })} className="h-11 tabular-nums" />}
        </Field>
      </div>
      <Picker label="Size" value={draft.size} options={SIZES} onChange={(size) => set({ size })} />
      <Picker label="Damage type" value={draft.damageType} options={DAMAGE_TYPES} onChange={(damageType) => set({ damageType })} />
      <Picker label="Attack type" value={draft.attackType} options={ATTACK_TYPES} onChange={(attackType) => set({ attackType })} />
      <div className="flex flex-wrap gap-2">
        <Check checked={draft.wielded} onChange={(wielded) => set({ wielded })}>
          Wielded
        </Check>
        <Check checked={draft.reach} onChange={(reach) => set({ reach })}>
          Reach
        </Check>
      </div>
      <div className="flex gap-2">
        <Button size="compact" variant="line-primary" type="submit" disabled={!draft.name.trim() || misc === null}>
          Add
        </Button>
        <Button size="compact" type="button" variant="ghost" onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

type NewItem = { name: string; slots: string; quantity: string; notes: string }
const BLANK_ITEM: NewItem = { name: '', slots: '1', quantity: '1', notes: '' }

function AddItem({ onChange }: { onChange: (action: ActionDraft) => unknown }) {
  const [draft, setDraft] = useState<NewItem | null>(null)
  if (!draft) {
    return (
      <Button size="compact" type="button" variant="line" className="self-start" onClick={() => setDraft(BLANK_ITEM)}>
        Add item
      </Button>
    )
  }
  const slots = parseNumber(draft.slots, 'decimal')
  const quantity = parseNumber(draft.quantity, 'count')
  const valid = draft.name.trim() !== '' && slots !== null && quantity !== null
  const set = (patch: Partial<NewItem>) => setDraft({ ...draft, ...patch })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onChange({ kind: 'gear:item:add', item: { name: draft.name.trim(), slots: slots!, quantity: quantity!, notes: draft.notes.trim() } })
    setDraft(null)
  }
  return (
    <form onSubmit={submit} aria-label="New item" className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-end gap-2">
        <Field label="New item">
          {(id) => <Input id={id} autoFocus value={draft.name} placeholder="Food ration" onChange={(e) => set({ name: e.target.value })} className="h-11" />}
        </Field>
        <Field label="Slots">
          {(id) => (
            <Input id={id} inputMode="decimal" value={draft.slots} aria-invalid={slots === null} onChange={(e) => set({ slots: e.target.value })} className="h-11 tabular-nums" />
          )}
        </Field>
        <Field label="Qty">
          {(id) => (
            <Input id={id} inputMode="numeric" value={draft.quantity} aria-invalid={quantity === null} onChange={(e) => set({ quantity: e.target.value })} className="h-11 tabular-nums" />
          )}
        </Field>
      </div>
      <Field label="Notes">{(id) => <Input id={id} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} className="h-11" />}</Field>
      <p className="text-meta text-muted-foreground">Slots are per item; the meter counts slots × quantity.</p>
      <div className="flex gap-2">
        <Button size="compact" variant="line-primary" type="submit" disabled={!valid}>
          Add
        </Button>
        <Button size="compact" type="button" variant="ghost" onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
