import { useState, type ReactNode } from 'react'
import type { PlayCondition } from '@heartrush/rules-engine/catalogue'
import type { Condition } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { AddConditionDialog } from './conditions/AddConditionDialog'
import { LevelDots } from './conditions/LevelDots'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

/** One line on the sheet: a rulebook condition (its manual and sleep rows together) or one custom row. */
type Line =
  | { kind: 'catalogue'; conditionId: string; entry: PlayCondition | null; manual: Condition | null; sleepLevels: number; sleepRows: number }
  | { kind: 'custom'; row: Condition }

function lines(conditions: Condition[], catalogue: ReadonlyMap<string, PlayCondition>): Line[] {
  const out: Line[] = []
  const byId = new Map<string, Extract<Line, { kind: 'catalogue' }>>()
  for (const k of conditions) {
    if (k.conditionId === null) {
      out.push({ kind: 'custom', row: k })
      continue
    }
    let line = byId.get(k.conditionId)
    if (!line) {
      line = { kind: 'catalogue', conditionId: k.conditionId, entry: catalogue.get(k.conditionId) ?? null, manual: null, sleepLevels: 0, sleepRows: 0 }
      byId.set(k.conditionId, line)
      out.push(line)
    }
    if (k.source === 'manual') line.manual = k
    else {
      line.sleepLevels += k.level ?? 1
      line.sleepRows += 1
    }
  }
  return out
}

/** INV-CATREF: a condition id no longer in the rulebook shows its id's last part, e.g. "off-balanced". */
const fallbackTitle = (conditionId: string) => conditionId.split('~').pop() ?? conditionId

/**
 * Conditions: one line per condition with its level dots (tap a dot to set the level), its tags, a **Permanent**
 * toggle and **Remove**, all one tap and undoable. A condition's levels from failed sleep are counted in the dots but
 * only a successful long rest removes them, so those dots are not buttons. [+] opens the picker.
 */
export function ConditionsSection({ character, catalogue, dispatch, canEdit }: SectionProps) {
  const [adding, setAdding] = useState(false)
  const shown = lines(character.conditions, catalogue.conditions)

  return (
    <Section
      title="Conditions"
      action={
        canEdit && (
          <Button size="compact-icon" variant="ghost" aria-label="Add a condition" onClick={() => setAdding(true)}>
            +
          </Button>
        )
      }
    >
      {shown.length === 0 ? (
        <p className="text-ui text-muted-foreground">No conditions.</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((line) =>
            line.kind === 'catalogue' ? (
              <CatalogueLine key={line.conditionId} line={line} dispatch={dispatch} canEdit={canEdit} />
            ) : (
              <CustomLine key={line.row.id} row={line.row} dispatch={dispatch} canEdit={canEdit} />
            ),
          )}
        </ul>
      )}
      {canEdit && (
        <AddConditionDialog open={adding} onOpenChange={setAdding} character={character} conditions={catalogue.conditions} dispatch={dispatch} />
      )}
    </Section>
  )
}

type LineProps = Pick<SectionProps, 'dispatch' | 'canEdit'>

function CatalogueLine({ line, dispatch, canEdit }: LineProps & { line: Extract<Line, { kind: 'catalogue' }> }) {
  const { entry, manual, sleepLevels, conditionId } = line
  const title = entry?.title ?? fallbackTitle(conditionId)
  const leveled = entry ? entry.leveled : (manual?.level ?? null) !== null
  const manualLevel = manual?.level ?? 0
  const total = manualLevel + sleepLevels
  const permanent = manual?.permanent ?? false
  const tag = permanent ? 'permanent' : entry?.fading ? 'fading' : entry?.ongoing ? 'ongoing' : null
  const set = (level: number | null, nextPermanent?: boolean) =>
    void dispatch({ kind: 'condition:set', conditionId, level, ...(nextPermanent !== undefined ? { permanent: nextPermanent } : {}) })

  return (
    <Row
      title={title}
      unresolved={entry === null}
      tag={tag}
      note={line.sleepRows > 0 ? `${sleepLevels} ${sleepLevels === 1 ? 'level' : 'levels'} from failed sleep; a successful long rest removes ${sleepLevels === 1 ? 'it' : 'them'}${entry?.fading ? ', and each new round fades one' : ''}` : null}
      dots={
        leveled ? (
          <LevelDots
            name={title}
            level={total}
            floor={sleepLevels}
            onSet={canEdit ? (n) => n !== total && set(n - sleepLevels) : undefined}
          />
        ) : null
      }
      permanent={canEdit && manual ? { on: permanent, toggle: () => set(manual.level, !permanent) } : null}
      onRemove={canEdit && manual ? () => set(0) : null}
    />
  )
}

function CustomLine({ row, dispatch, canEdit }: LineProps & { row: Condition }) {
  const name = row.name ?? 'Custom condition'
  const affects = row.affects.length ? `disadvantage on ${row.affects.join(', ')}` : 'no ability penalty'
  const set = (level: number | null, permanent?: boolean) =>
    void dispatch({ kind: 'condition:custom', rowId: row.id, level, ...(permanent !== undefined ? { permanent } : {}) })
  return (
    <Row
      title={name}
      unresolved={false}
      tag={row.permanent ? 'permanent' : 'custom'}
      note={affects}
      dots={
        row.level !== null ? (
          <LevelDots name={name} level={row.level} onSet={canEdit ? (n) => n !== row.level && set(n) : undefined} />
        ) : null
      }
      permanent={canEdit ? { on: row.permanent, toggle: () => set(row.level, !row.permanent) } : null}
      onRemove={canEdit ? () => set(0) : null}
    />
  )
}

function Row({
  title, unresolved, tag, note, dots, permanent, onRemove,
}: {
  title: string
  unresolved: boolean
  tag: string | null
  note: string | null
  dots: ReactNode
  permanent: { on: boolean; toggle: () => void } | null
  onRemove: (() => void) | null
}) {
  return (
    <li className="flex flex-col border-b border-border py-1 last:border-b-0">
      <div className="flex min-h-11 flex-wrap items-center gap-x-2">
        <span className="min-w-0 flex-1 text-ui font-medium">
          {title}
          {tag && <span className="ml-2 text-meta font-normal text-muted-foreground">{tag}</span>}
          {unresolved && <span className="ml-2 text-meta font-normal text-muted-foreground">no longer in the rulebook</span>}
        </span>
        {dots}
        <span className="flex shrink-0 items-center">
          {permanent && (
            <Button size="compact"
              variant="ghost"
              aria-pressed={permanent.on}
              aria-label={`${title}: ${permanent.on ? 'permanent. Remove permanent status' : 'make permanent'}`}
              className={`px-2 text-meta ${permanent.on ? 'text-foreground' : 'text-muted-foreground'}`}
              onClick={permanent.toggle}
            >
              {permanent.on ? 'Permanent ✓' : 'Permanent'}
            </Button>
          )}
          {onRemove && (
            <Button size="compact-icon" variant="ghost" aria-label={`Remove ${title}`} onClick={onRemove}>
              ✕
            </Button>
          )}
        </span>
      </div>
      {note && <p className="pb-1 text-meta text-muted-foreground">{note}</p>}
    </li>
  )
}
