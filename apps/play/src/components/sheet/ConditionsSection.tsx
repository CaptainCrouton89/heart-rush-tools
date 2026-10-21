import { useRef, useState, type ReactNode, type RefObject } from 'react'
import { useMatch } from '@tanstack/react-router'
import type { PlayCondition } from '@heartrush/rules-engine/catalogue'
import { CONDITION } from '@heartrush/rules-engine/conditions'
import type { RollType } from '@heartrush/rules-engine/dice'
import type { AbilityId, Condition } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { RollPanel } from '../roll/RollPanel'
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

/** A roll a condition lets its bearer make to end it (`Conditions.md`); the CN comes from the GM and the roller does not resolve it. */
type EscapeRoll = { label: string; ability: AbilityId; type: RollType }

/**
 * Grappled: break free with a Might or Agility check (the grapple's own restrained level gives no disadvantage on it; the
 * catalogue's Restrained penalizes no ability by default, so the roll starts with none from it). Entangled: Wriggle Out
 * (Agility) or Tear Free (Might). Aggravated and Frightened: a Cunning save. Confused ends with an ally's help: none.
 */
const ESCAPES: Record<string, EscapeRoll[]> = {
  [CONDITION.grappled]: [
    { label: 'Break free (Might)', ability: 'might', type: 'check' },
    { label: 'Break free (Agility)', ability: 'agility', type: 'check' },
  ],
  [CONDITION.entangled]: [
    { label: 'Wriggle Out', ability: 'agility', type: 'check' },
    { label: 'Tear Free', ability: 'might', type: 'check' },
  ],
  [CONDITION.aggravated]: [{ label: 'Save (Cunning)', ability: 'cunning', type: 'save' }],
  [CONDITION.frightened]: [{ label: 'Save (Cunning)', ability: 'cunning', type: 'save' }],
}

/** INV-CATREF: a condition id no longer in the rulebook shows its id's last part, e.g. "off-balanced". */
const fallbackTitle = (conditionId: string) => conditionId.split('~').pop() ?? conditionId

/**
 * Conditions: one line per condition with its level dots (tap a dot to set the level), its tags, a **Permanent**
 * toggle and **Remove**, all one tap and undoable. A condition's levels from failed sleep are counted in the dots but
 * only a successful long rest removes them, so those dots are not buttons. [+] opens the picker. A condition with an
 * escape roll (`ESCAPES`) shows one button per roll on the sheet route; each opens the roll panel preset to it.
 */
export function ConditionsSection({ character, catalogue, dispatch, canEdit }: SectionProps) {
  const [adding, setAdding] = useState(false)
  const shown = lines(character.conditions, catalogue.conditions)
  // The roll panel needs the character's id, which only the sheet route has (the GM view renders this section too).
  const sheetId = useMatch({ from: '/characters/$id', shouldThrow: false })?.loaderData?.id ?? null
  const canRoll = canEdit && sheetId !== null
  const [rolling, setRolling] = useState<EscapeRoll | null>(null)
  const anchor = useRef<HTMLElement | null>(null)
  const openRoll = (roll: EscapeRoll, opener: HTMLElement) => {
    anchor.current = opener
    setRolling(roll)
  }

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
              <CatalogueLine key={line.conditionId} line={line} dispatch={dispatch} canEdit={canEdit} onRoll={canRoll ? openRoll : null} />
            ) : (
              <CustomLine key={line.row.id} row={line.row} dispatch={dispatch} canEdit={canEdit} />
            ),
          )}
        </ul>
      )}
      {canEdit && (
        <AddConditionDialog open={adding} onOpenChange={setAdding} character={character} conditions={catalogue.conditions} dispatch={dispatch} />
      )}
      {rolling && sheetId !== null && (
        <RollPanel
          character={{ id: sheetId, name: character.identity.name, state: character }}
          ability={rolling.ability}
          type={rolling.type}
          anchor={anchor as RefObject<HTMLElement | null>}
          onClose={() => setRolling(null)}
        />
      )}
    </Section>
  )
}

type LineProps = Pick<SectionProps, 'dispatch' | 'canEdit'>

function CatalogueLine({
  line, dispatch, canEdit, onRoll,
}: LineProps & { line: Extract<Line, { kind: 'catalogue' }>; onRoll: ((roll: EscapeRoll, opener: HTMLElement) => void) | null }) {
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
      actions={
        onRoll && ESCAPES[conditionId] ? (
          <div className="flex flex-wrap gap-2 pb-1">
            {ESCAPES[conditionId].map((roll) => (
              <Button key={roll.label} size="compact" variant="line" className="px-3" aria-haspopup="dialog" onClick={(e) => onRoll(roll, e.currentTarget)}>
                {roll.label}
              </Button>
            ))}
          </div>
        ) : null
      }
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
  title, unresolved, tag, note, dots, permanent, onRemove, actions = null,
}: {
  title: string
  unresolved: boolean
  tag: string | null
  note: string | null
  dots: ReactNode
  permanent: { on: boolean; toggle: () => void } | null
  onRemove: (() => void) | null
  /** Buttons under the line (a condition's escape rolls). */
  actions?: ReactNode
}) {
  return (
    <li className="flex flex-col border-b border-border py-1 last:border-b-0">
      <div className="flex min-h-11 flex-wrap items-center gap-x-2">
        <span className="flex-1 text-ui font-medium">
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
      {actions}
    </li>
  )
}
