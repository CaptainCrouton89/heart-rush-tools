import { useId } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { AGE } from './draft-rules'
import { Field, selectClass, type UseDraft } from './use-draft'

const MAX_PROFESSIONS = 3

/**
 * Step 4 (Starting Professions): up to three professions with rank steppers. The ranks add up to 2 / 4 / 5 by age,
 * each profession at most 3 (4 when elderly); the + button is disabled once either limit is reached.
 */
export function StepProfessions({ draft }: { draft: UseDraft }) {
  const ids = useId()
  const { builder, update } = draft
  const age = AGE[builder.ageCategory]
  const rows = builder.professions
  const total = rows.reduce((n, p) => n + p.rank, 0)
  const remaining = age.ranks - total

  const setRows = (next: typeof rows) => update((b) => ({ ...b, professions: next }))
  const edit = (i: number, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  return (
    <div className="flex flex-col gap-6">
      <p className="font-serif text-body-sm text-muted-foreground">
        Choose up to three professions and share {age.ranks} ranks between them ({age.label.toLowerCase()}). No profession may have more than{' '}
        {age.cap} ranks. A profession&rsquo;s rank is added to rolls it applies to.
      </p>
      <p className="text-control font-semibold tabular-nums" aria-live="polite">
        {remaining >= 0 ? `${remaining} of ${age.ranks} ranks left` : `${-remaining} ranks too many (${total} of ${age.ranks})`}
      </p>

      <ul className="flex flex-col gap-3">
        {rows.map((p, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Profession ${i + 1}`}
              className="h-11 min-w-40 flex-1"
              placeholder="Blacksmith, Scholar, Smuggler…"
              value={p.name}
              onChange={(e) => edit(i, { name: e.target.value })}
            />
            <div role="group" aria-label={`${p.name.trim() || `Profession ${i + 1}`} rank`} className="flex items-center gap-1">
              <Button size="compact-icon" type="button" variant="line" aria-label="One rank fewer" disabled={p.rank <= 1} onClick={() => edit(i, { rank: p.rank - 1 })}>
                −
              </Button>
              <span className="w-10 text-center text-control font-semibold tabular-nums" aria-live="polite">
                {p.rank}
              </span>
              <Button size="compact-icon"
                type="button"
                variant="line"
                aria-label="One rank more"
                disabled={remaining <= 0 || p.rank >= age.cap}
                onClick={() => edit(i, { rank: p.rank + 1 })}
              >
                +
              </Button>
            </div>
            <Button size="compact" type="button" variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {rows.length < MAX_PROFESSIONS && (
        <Button size="compact" type="button" variant="line" className="self-start" disabled={remaining <= 0} onClick={() => setRows([...rows, { name: '', rank: 1 }])}>
          Add a profession
        </Button>
      )}

      {builder.ageBenefits.includes('wisdom-of-experience') && (
        <Field label="Wisdom of Experience applies to" htmlFor={`${ids}-wisdom`} hint="Skill checks with this profession may reroll 1s.">
          <select
            id={`${ids}-wisdom`}
            className={selectClass}
            value={builder.ageBenefitProfession ?? ''}
            onChange={(e) => update({ ageBenefitProfession: e.target.value })}
          >
            <option value="">Choose a profession</option>
            {rows
              .filter((p) => p.name.trim())
              .map((p) => (
                <option key={p.name} value={p.name.trim()}>
                  {p.name.trim()}
                </option>
              ))}
          </select>
        </Field>
      )}
    </div>
  )
}
