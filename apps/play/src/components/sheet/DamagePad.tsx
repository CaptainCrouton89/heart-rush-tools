import { useState, type FormEvent } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@heartrush/ui/components/dialog'
import { Input } from '@heartrush/ui/components/input'
import type { ActionDraft } from './use-character'

/** The amount field's id: the sticky bar's HP button focuses it. */
export const DAMAGE_AMOUNT_ID = 'damage-amount'

/** Damage of this much or more always leaves a wound of that rank (Heart Rush: a hit of 10+ is a wound). */
const WOUND_AT = 10

/**
 * HP pad: type an amount (numeric keyboard), then **Damage** or **Heal**; − and + step the amount by one. Damage of
 * 10 or more first asks for the wound's description and applies on **Mark**, as one `damage` action carrying it:
 * the wound itself is not optional, so there is no skip (a blank description is accepted). **Change amount** goes
 * back to the pad without applying anything.
 */
export function DamagePad({ dispatch }: { dispatch: (action: ActionDraft) => unknown }) {
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
        <Button size="compact-lg" variant="line-primary" type="button" className="min-w-0 flex-1 px-2" disabled={amount < 1} onClick={damage}>
          Damage
        </Button>
        <Button size="compact-lg" type="button" variant="line" className="min-w-0 flex-1 px-2" disabled={amount < 1} onClick={heal}>
          Heal
        </Button>
      </div>

      <Dialog open={wound !== null} onOpenChange={(open) => !open && setWound(null)}>
        <DialogContent showClose={false}>
          <form onSubmit={mark} className="flex flex-col gap-4">
            <DialogHeader className="pr-0">
              <DialogTitle>Wound of rank {wound?.amount} — describe it</DialogTitle>
              <DialogDescription>
                Taking {wound?.amount} damage marks a wound of rank {wound?.amount}. It lowers max HP by {wound?.amount} until it heals.
              </DialogDescription>
            </DialogHeader>
            <Input
              aria-label="Wound description"
              placeholder="e.g. fractured leg"
              autoFocus
              value={wound?.description ?? ''}
              onChange={(e) => setWound((w) => (w ? { ...w, description: e.target.value } : w))}
              className="h-12"
            />
            <DialogFooter>
              <Button size="compact" type="button" variant="ghost" onClick={() => setWound(null)}>
                Change amount
              </Button>
              <Button size="compact" variant="line-primary" type="submit">
                Mark
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
