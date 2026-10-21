import { hinderGain, isFrail } from '@heartrush/rules-engine/reducers/combat'
import type { Aspect } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@heartrush/ui/components/dropdown-menu'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'
import { Written } from '~/components/motion'

const SOURCE: Record<Aspect['source'], string> = { race: 'kin', age: 'age', created: 'created', purchased: 'bought', growth: 'growth' }

/**
 * The character's aspects with rank and the honor tick (`aspect:edit`; honor is what a Neth Human's discount
 * applies to). Ranks and new aspects cost XP, so they change through Advance, not here. With `canEdit` each row
 * has **Use −N** (`aspect:invoke`: spend up to the rank in DP for that bonus; a picker when the rank is above 1; never
 * for Frail, which the age benefit Frail Body, Sharp Mind allows only against the character) and **Hinder +N**
 * (`aspect:hinder`: gain the rank, +1 with Young and Foolish, up to 10 DP).
 */
export function AspectsSection({ character, dispatch, canEdit }: SectionProps) {
  const { dp } = character.play
  const use = (a: Aspect, n: number) => void dispatch({ kind: 'aspect:invoke', aspectId: a.id, dp: n })
  return (
    <Section title="Aspects">
      {character.aspects.length === 0 ? (
        <p className="text-ui text-muted-foreground">No aspects.</p>
      ) : (
        <ul className="flex flex-col">
          {character.aspects.map((a) => {
            // What a hinder adds now: the gain, clipped at the 10 DP cap.
            const gain = dp >= 10 ? hinderGain(character, a) : Math.min(hinderGain(character, a), 10 - dp)
            return (
              <li key={a.id} className="flex min-h-11 flex-wrap items-center gap-x-3 border-b border-border py-1 last:border-b-0">
                <span className="w-6 shrink-0 text-center font-hand text-[19px]" aria-label={`Rank ${a.rank}`}>
                  <Written value={a.rank} />
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-ui break-words">{a.text || <span className="text-muted-foreground">Unnamed aspect</span>}</p>
                  <p className="text-meta text-muted-foreground">
                    {SOURCE[a.source]}
                    {isFrail(a) && ' · invoked negatively only'}
                  </p>
                </div>
                {/* On a phone the controls wrap below the text instead of squeezing it. */}
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {canEdit && (
                    <>
                      {!isFrail(a) && <UseButton aspect={a} dp={dp} onUse={(n) => use(a, n)} />}
                      <Button
                        size="compact"
                        variant="line"
                        className="px-2.5"
                        disabled={dp >= 10}
                        aria-label={`Hinder: "${a.text}" works against you, gain ${gain} DP`}
                        onClick={() => void dispatch({ kind: 'aspect:hinder', aspectId: a.id })}
                      >
                        Hinder +{gain}
                      </Button>
                    </>
                  )}
                  {canEdit ? (
                    <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 text-ui">
                      <input
                        type="checkbox"
                        checked={a.honor}
                        onChange={(e) => void dispatch({ kind: 'aspect:edit', aspect: { id: a.id, honor: e.target.checked } })}
                        className="size-5 accent-primary"
                      />
                      Honor
                    </label>
                  ) : (
                    a.honor && <span className="shrink-0 text-meta font-medium">honor</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {canEdit && character.aspects.length > 0 && (
        <p className="pt-2 text-meta text-muted-foreground">Negative invocations: 5 DP per scene at most; none on a stratagem roll.</p>
      )}
    </Section>
  )
}

/** **Use −N** for one aspect: one tap at rank 1, otherwise a menu of 1…rank DP (each greyed when DP is short). */
function UseButton({ aspect, dp, onUse }: { aspect: Aspect; dp: number; onUse: (n: number) => void }) {
  if (aspect.rank === 1) {
    return (
      <Button size="compact" variant="line" className="px-2.5" disabled={dp < 1} aria-label={`Use "${aspect.text}": spend 1 DP for +1`} onClick={() => onUse(1)}>
        Use −1
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="compact" variant="line" className="px-2.5" disabled={dp < 1} aria-label={`Use "${aspect.text}": choose how many DP to spend`}>
          Use −1…{aspect.rank} <span aria-hidden="true">▾</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Spend DP for the same bonus</DropdownMenuLabel>
        {Array.from({ length: aspect.rank }, (_, i) => i + 1).map((n) => (
          <DropdownMenuItem key={n} className="min-h-11" disabled={dp < n} onSelect={() => onUse(n)}>
            −{n} DP, +{n} to the roll
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
