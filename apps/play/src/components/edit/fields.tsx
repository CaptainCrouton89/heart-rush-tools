// Form pieces the edit page and the builder's gear step share. A text or number field holds what the person types
// and commits once, on blur or Enter, only when the value changed — so one edit is one action, not one per keystroke.
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { Textarea } from '@heartrush/ui/components/textarea'
import { ToggleGroup, ToggleGroupItem } from '@heartrush/ui/components/toggle-group'
import { cn } from '@heartrush/ui/lib/utils'

export const labelClass = 'text-ui font-medium text-foreground'

/** A label above its control. */
export function Field({ label, children, className }: { label: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children(id)}
    </div>
  )
}

/** Shows `value`, follows it when the document changes, and calls `onCommit` with the new text on blur or Enter. */
export function CommitText({
  id,
  value,
  onCommit,
  multiline,
  placeholder,
  label,
  className,
}: {
  id?: string
  value: string
  onCommit: (text: string) => void
  multiline?: boolean
  placeholder?: string
  /** `aria-label` when the field has no visible label. */
  label?: string
  className?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = () => {
    if (text !== value) onCommit(text)
  }
  if (multiline) {
    return (
      <Textarea id={id} aria-label={label} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={commit} className={className} />
    )
  }
  return (
    <Input
      id={id}
      aria-label={label}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={cn('h-11', className)}
    />
  )
}

/** What a number field accepts: a whole number ≥ 0, a whole number with a sign, or a decimal ≥ 0. */
export type NumberKind = 'count' | 'signed' | 'decimal'

const PATTERN: Record<NumberKind, RegExp> = {
  count: /^\d+$/,
  signed: /^[-−+]?\d+$/,
  decimal: /^\d*\.?\d+$|^\d+\.$/,
}

/**
 * The phone keyboard for a `kind` number. The numeric and decimal keypads have no minus key, so a signed field is a
 * `type="number"` input, whose keyboard has one.
 */
export const numberInputProps = (kind: NumberKind) =>
  kind === 'signed' ? ({ type: 'number', step: 1 } as const) : ({ inputMode: kind === 'decimal' ? 'decimal' : 'numeric' } as const)

/** The number `text` holds, or null when it is not a `kind` number. */
export function parseNumber(text: string, kind: NumberKind): number | null {
  const t = text.trim()
  if (!PATTERN[kind].test(t)) return null
  return Number(t.replace('−', '-'))
}

/**
 * A number field. A value that is not a `kind` number, or is above `max`, is not committed: the field goes back to
 * the stored value.
 */
export function CommitNumber({
  id,
  value,
  onCommit,
  kind = 'count',
  max,
  label,
  className,
}: {
  id?: string
  value: number
  onCommit: (n: number) => void
  kind?: NumberKind
  max?: number
  label?: string
  className?: string
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const n = parseNumber(text, kind)
    if (n === null || (max !== undefined && n > max)) return setText(String(value))
    if (n !== value) onCommit(n)
  }
  return (
    <Input
      id={id}
      aria-label={label}
      {...numberInputProps(kind)}
      autoComplete="off"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={cn('h-11 tabular-nums', className)}
    />
  )
}

/** A one-of-N segmented control. Tapping the chosen item again keeps it chosen. */
export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <ToggleGroup
        type="single"
        aria-label={label}
        value={value}
        onValueChange={(v) => {
          if (v && v !== value) onChange(v as T)
        }}
        className="w-full"
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value} className="px-2">
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/** An on/off button that reads as a checkbox ("✓ Worn"). */
export function Check({ checked, onChange, children, label }: { checked: boolean; onChange: (next: boolean) => void; children: ReactNode; label?: string }) {
  return (
    <Button size="compact"
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      variant={checked ? 'secondary' : 'line'}
      className="px-3"
      onClick={() => onChange(!checked)}
    >
      {checked ? '✓ ' : ''}
      {children}
    </Button>
  )
}

/** A titled block of the edit page; `id` is the anchor the sheet's Edit links jump to. */
export function EditBlock({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-44 flex-col gap-4 md:scroll-mt-48">
      <h2 id={`${id}-title`} className="border-b border-border pb-2 font-serif text-h3 font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}
