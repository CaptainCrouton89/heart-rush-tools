import { useState, type FormEvent } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@heartrush/ui/components/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@heartrush/ui/components/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@heartrush/ui/components/toggle-group'
import { sleepPenalty } from '@heartrush/rules-engine/conditions'
import { SLEEP_EACH } from '@heartrush/rules-engine/reducers/combat'
import type { SectionProps } from './SheetLayout'

type Rolled = 'weakened' | 'off-balanced' | 'dazed'
const SLEEP_CONDITIONS: { value: Rolled; label: string }[] = [
  { value: 'weakened', label: 'Weakened' },
  { value: 'off-balanced', label: 'Off-Balanced' },
  { value: 'dazed', label: 'Dazed' },
]

const ITEM = 'min-h-11 flex-col items-start gap-0'

/**
 * **Rest ▾**: Short rest and Long rest (successful) apply on the tap that picks them; Long rest (failed) asks which
 * condition each random roll gave — "Night N of failed sleep: roll for M condition(s)" — and sends one `longRest`
 * action with exactly M ticks (the button stays disabled until every roll is ticked). From night 3 there is no roll:
 * the dialog says one level of each is coming and sends all three.
 */
export function RestMenu({ character, dispatch, canEdit }: SectionProps) {
  const [failed, setFailed] = useState<(Rolled | null)[] | null>(null)
  if (!canEdit) return null

  const night = character.play.failedRestStreak + 1
  const penalty = sleepPenalty(night)
  const rolls = penalty.kind === 'roll' ? penalty.count : 0
  const picked = failed?.filter((r): r is Rolled => r !== null) ?? []

  const openFailed = () => setFailed(Array.from({ length: rolls }, () => null))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!failed || picked.length !== rolls) return
    void dispatch({ kind: 'longRest', successful: false, rolled: penalty.kind === 'each' ? Array.from(SLEEP_EACH) : picked })
    setFailed(null)
  }

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="compact" variant="line">
            Rest <span aria-hidden="true">▾</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem className={ITEM} onSelect={() => void dispatch({ kind: 'shortRest' })}>
            <span className="font-medium">Short rest</span>
            <span className="text-meta text-muted-foreground">Heart die back to its largest size</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM} onSelect={() => void dispatch({ kind: 'longRest', successful: true })}>
            <span className="font-medium">Long rest (successful)</span>
            <span className="text-meta text-muted-foreground">Wounds −1, full HP, major abilities reset, sleep conditions gone</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM} onSelect={openFailed}>
            <span className="font-medium">Long rest (failed)…</span>
            <span className="text-meta text-muted-foreground">Half missing HP, wounds stay, sleep conditions</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {character.play.failedRestStreak > 0 && (
        <span className="text-meta text-muted-foreground">
          {character.play.failedRestStreak} {character.play.failedRestStreak === 1 ? 'night' : 'nights'} of failed sleep
        </span>
      )}

      <Dialog open={failed !== null} onOpenChange={(open) => !open && setFailed(null)}>
        <DialogContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {penalty.kind === 'each'
                  ? `Night ${night} of failed sleep: one level of each condition`
                  : `Night ${night} of failed sleep: roll for ${rolls} ${rolls === 1 ? 'condition' : 'conditions'}`}
              </DialogTitle>
              <DialogDescription>
                {penalty.kind === 'each'
                  ? 'No roll: you take a level of weakened, off-balanced and dazed. You regain half your missing HP; wounds do not heal.'
                  : `Roll for ${rolls === 1 ? 'a random condition' : `${rolls} random conditions`} (weakened, off-balanced or dazed) and tick what${rolls === 1 ? ' it gives' : ' each roll gives'}. You regain half your missing HP; wounds do not heal.`}
              </DialogDescription>
            </DialogHeader>
            {failed?.map((value, i) => (
              <div key={i} className="flex flex-col gap-1">
                {rolls > 1 && <span className="text-ui">Roll {i + 1}</span>}
                <ToggleGroup
                  type="single"
                  aria-label={`Roll ${i + 1}`}
                  value={value ?? ''}
                  onValueChange={(v) => setFailed((list) => list && list.map((r, j) => (j === i ? ((v || null) as Rolled | null) : r)))}
                  className="w-full"
                >
                  {SLEEP_CONDITIONS.map((c) => (
                    <ToggleGroupItem key={c.value} value={c.value}>
                      {c.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}
            <DialogFooter>
              {rolls > 0 && (
                <span className="mr-auto self-center text-meta text-muted-foreground">
                  {picked.length} of {rolls} ticked
                </span>
              )}
              <Button size="compact" variant="line-primary" type="submit" disabled={picked.length !== rolls}>
                Rest
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
