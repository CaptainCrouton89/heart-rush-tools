import type { ReactNode } from 'react'
import { price, xpRemaining } from '@heartrush/rules-engine/pricing'
import { RuleError, type Character, type PriceTarget, type PurchaseKind } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { refusalReason } from '~/components/sheet/refusal-text'

/**
 * What a purchase would cost now, from the engine's `price()` (INV-DERIVED: the UI never computes a price).
 * `cost` is null when the rules refuse the purchase outright (die at its cap, path locked, not attuned …);
 * `refusal` is the plain-words reason the Buy button is disabled: that refusal, or "not enough XP" when the
 * price is above the remaining XP (the price still shows).
 */
export type Quote = { cost: number | null; refusal: string | null }

export function quote(character: Character, kind: PurchaseKind, target?: PriceTarget): Quote {
  let cost: number
  try {
    cost = price(character, kind, target)
  } catch (e) {
    if (!(e instanceof RuleError)) throw e
    return { cost: null, refusal: refusalReason(e.code, e.message) }
  }
  const remaining = xpRemaining(character)
  return { cost, refusal: cost > remaining ? `not enough XP (${remaining} left)` : null }
}

/** The Buy button with its price: "Buy · 8 XP". Disabled when the quote has a refusal; the price still shows. */
export function BuyButton({ q, onBuy, label = 'Buy', disabled }: { q: Quote; onBuy: () => void; label?: string; disabled?: boolean }) {
  const blocked = q.refusal !== null || disabled
  return (
    <Button size="compact" variant="line-primary" type="button" className="shrink-0 tabular-nums" disabled={blocked} onClick={onBuy}>
      {label}
      {q.cost !== null && <span aria-hidden="true">· <span className="font-hand text-[16px] font-normal">{q.cost}</span> XP</span>}
      {q.cost !== null && <span className="sr-only">for {q.cost} XP</span>}
    </Button>
  )
}

/** One purchasable line: what it is, then the Buy button; the refusal reason, when there is one, under it. */
export function BuyRow({ title, detail, q, onBuy, label, disabled, children }: {
  title: ReactNode
  detail?: ReactNode
  q: Quote
  onBuy: () => void
  label?: string
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <li className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <div className="font-serif text-[18px] leading-6 font-semibold">{title}</div>
          {detail && <div className="text-ui text-muted-foreground">{detail}</div>}
        </div>
        <BuyButton q={q} onBuy={onBuy} label={label} disabled={disabled} />
      </div>
      {children}
      {q.refusal && <p className="text-meta text-muted-foreground">Can't buy: {q.refusal}</p>}
    </li>
  )
}
