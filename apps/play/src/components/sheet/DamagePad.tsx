import { useState, type FormEvent } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import type { ActionDraft } from './use-character'

/** The amount field's id: the sticky bar's HP button focuses it. */
export const DAMAGE_AMOUNT_ID = 'damage-amount'

/** Damage of this much or more always leaves a wound of that rank (Heart Rush: a hit of 10+ is a wound). */
const WOUND_AT = 10

/**
 * HP pad: type an amount (numeric keyboard), then **Damage** or **Heal**; − and + step the amount by one. Damage of
 * 10 or more first opens a strip under the pad asking for the wound's description and applies on **Mark**, as one
 * `damage` action carrying it: the wound itself is not optional, so there is no skip (a blank description is
 * accepted). **Change amount** closes the strip without applying anything. `maxHp` is the effective max HP the strip
 * shows the wound lowering.
 */
export function DamagePad({ dispatch, maxHp }: { dispatch: (action: ActionDraft) => unknown; maxHp: number }) {
  const [text, setText] = useState('')
  const [wound, setWound] = useState<{ amount: number; description: string } | null>(null)
  const amount = /^\d+$/.test(text) ? Number(text) : 0

  const step = (by: number) => setText(String(Math.max(0, amount + by) || ''))
  const done = () => setText('')

  const damage = () => {
    if (amount < 1) return
    if (amount >= WOUND_AT) return setWound({ amount, description: '' })
    void dispatch({ kind: 'damage', amount })
    done()
  }
  const heal = () => {
    if (amount < 1) return
    void dispatch({ kind: 'heal', amount })
    done()
  }
  const mark = (e: FormEvent) => {
    e.preventDefault()
    if (!wound) return
    void dispatch({ kind: 'damage', amount: wound.amount, woundDescription: wound.description.trim() })
    setWound(null)
    done()
  }

  return (
    <section aria-label="Damage and healing" className="flex flex-col gap-2">
      <label htmlFor={DAMAGE_AMOUNT_ID} className="eyebrow">
        Damage or heal
      </label>
      <div className="flex items-center gap-2">
        <Button size="compact-icon" type="button" variant="line" aria-label="One less" onClick={() => step(-1)}>
          −
        </Button>
        <Input
          id={DAMAGE_AMOUNT_ID}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="0"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') damage()
          }}
          className="h-9 w-16 shrink-0 px-2 text-center font-semibold tabular-nums md:text-control"
        />
        <Button size="compact-icon" type="button" variant="line" aria-label="One more" onClick={() => step(1)}>
          +
        </Button>
        <Button size="compact-lg" variant="line-primary" type="button" className="min-w-0 flex-1 px-2" disabled={amount < 1 || wound !== null} onClick={damage}>
          Damage
        </Button>
        <Button size="compact-lg" type="button" variant="line" className="min-w-0 flex-1 px-2" disabled={amount < 1 || wound !== null} onClick={heal}>
          Heal
        </Button>
      </div>

      {wound && (
        <div className="reveal">
          <form onSubmit={mark} className="flex flex-col gap-1.5 border-l-[1.5px] border-primary py-1 pl-3">
            <p className="text-ui">
              <span className="font-semibold text-wound">{wound.amount}</span> damage leaves a wound of rank {wound.amount}. Max HP {maxHp} →{' '}
              {maxHp - wound.amount} until it heals.
            </p>
            <div className="flex items-center gap-2.5">
              <Input
                aria-label="Describe the wound"
                placeholder="Describe it, e.g. fractured leg"
                autoFocus
                value={wound.description}
                onChange={(e) => setWound((w) => (w ? { ...w, description: e.target.value } : w))}
                className="h-9 min-w-0 flex-1"
              />
              <Button size="compact" variant="line-primary" type="submit">
                Mark
              </Button>
            </div>
            <Button size="compact" type="button" variant="link" className="self-start px-0 text-meta text-muted-foreground" onClick={() => setWound(null)}>
              Change amount
            </Button>
          </form>
        </div>
      )}
    </section>
  )
}
