import { useCallback } from 'react'
import { xpRemaining } from '@heartrush/rules-engine/pricing'
import type { ClientAction } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { getCatalogue } from '~/catalogue'
import { TalentCatalogue, type XpBuyAction } from '~/components/advance/TalentCatalogue'
import { SuggestTalents } from '~/components/ai/SuggestTalents'
import { describeAction } from '~/components/sheet/HistoryList'
import { Section } from '~/components/sheet/SheetLayout'
import { BloodmarkPanel } from './BloodmarkPanel'
import type { UseDraft } from './use-draft'

/** The pending actions step 6 makes; step 7's are `gear:*`. */
const isStep6 = (a: ClientAction) => a.kind === 'xp:buy' || a.kind === 'bloodmark:pick'

/**
 * Step 6 (Talents): "You start with 0 talents and N XP", the talent catalogue with live prices from the draft's preview
 * character, Suggest talents in its header, and the bloodmark picks panel for level ≥ 1. Buying appends the stamped
 * `xp:buy` to the draft's pending list as it is (the draft keeps the catalogue's id and time; ruling 8); it becomes an
 * ordinary event at Finish. The list of what this step added, with Remove, sits above the catalogue.
 */
export function StepTalents({ draft }: { draft: UseDraft }) {
  const { preview, pending, setPending } = draft
  const catalogue = getCatalogue()
  const buy = useCallback((action: XpBuyAction) => setPending((p) => [...p, action]), [setPending])
  const character = preview.character

  if (!character) {
    return <p className="text-ui text-muted-foreground">Finish steps 1–5 first; the talents you can buy depend on them.</p>
  }

  const invalid = new Set(preview.invalid.map((i) => i.action.id))
  const added = pending.filter(isStep6)
  const awarded = character.xp.awarded

  return (
    <div className="flex flex-col gap-8">
      <p className="font-serif text-body-sm text-muted-foreground">
        You start with 0 talents and {awarded} XP. Spend some now or later.
      </p>
      <p className="text-ui" aria-live="polite">
        <span className="font-serif text-h2-sm font-semibold tabular-nums">{xpRemaining(character)}</span>{' '}
        <span className="text-muted-foreground">XP left to spend</span>
      </p>

      {added.length > 0 && (
        <Section title="Added in this step">
          <ul className="flex flex-col">
            {added.map((a) => (
              <li key={a.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-border text-control last:border-b-0">
                <span className={invalid.has(a.id) ? 'text-destructive' : undefined}>
                  {describeAction(a)}
                  {invalid.has(a.id) && <span className="ml-2 text-meta">no longer allowed</span>}
                </span>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setPending((p) => p.filter((x) => x.id !== a.id))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <BloodmarkPanel draft={draft} character={character} />

      <Section title="Talents">
        <TalentCatalogue
          character={character}
          catalogue={catalogue}
          onBuy={buy}
          header={<SuggestTalents characterId={draft.id} character={character} catalogue={catalogue} onBuy={buy} />}
        />
      </Section>
    </div>
  )
}
