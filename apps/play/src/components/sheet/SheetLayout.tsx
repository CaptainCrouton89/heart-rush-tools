import { useState, type ReactNode } from 'react'
import type { Character } from '@heartrush/rules-engine/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@heartrush/ui/components/tabs'
import type { PlayCatalogue } from '~/catalogue'
import type { Derived } from '~/server/characters'
import type { ActionDraft, Outcome } from './use-character'
import { AbilitiesSection } from './AbilitiesSection'
import { AspectsSection } from './AspectsSection'
import { ConditionsSection } from './ConditionsSection'
import { FightControls } from './FightControls'
import { GearSection } from './GearSection'
import { JournalSection } from './JournalSection'
import { NotesSection } from './NotesSection'
import { ProfessionsSection } from './ProfessionsSection'
import { RaceEffectsNote } from './RaceEffectsNote'
import { RestMenu } from './RestMenu'
import { WoundsSection } from './WoundsSection'

/**
 * What every sheet section receives. `dispatch` is the sheet's one way to change the character (INV-ACTION): it
 * stamps, applies on screen and sends, and a saved action raises the undo chip. `canEdit` is false for a player
 * viewing someone else's character; a section then shows its values without controls.
 */
export type SectionProps = {
  character: Character
  derived: Derived
  catalogue: PlayCatalogue
  dispatch: (action: ActionDraft) => Promise<Outcome>
  canEdit: boolean
}

/** A titled block of the sheet: the heading is the small uppercase label the design's wireframes show. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border">
        <h2 className="eyebrow">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

type Tab = 'sheet' | 'abilities' | 'gear' | 'aspects' | 'more'
const TABS: { value: Tab; label: string }[] = [
  { value: 'sheet', label: 'Sheet' },
  { value: 'abilities', label: 'Abilities' },
  { value: 'gear', label: 'Gear' },
  { value: 'aspects', label: 'Aspects' },
  { value: 'more', label: 'More' },
]

// Below 1024 px one panel shows at a time; from 1024 px every panel shows and the tab bar is gone (design: desktop
// has three columns and no tabs). Panels stay mounted so a section keeps its state across tab switches.
const PANEL = 'flex flex-col gap-6 data-[state=inactive]:hidden lg:data-[state=inactive]:flex'

/**
 * The sheet's arrangement. Phone: the top section (identity, ability rows, the speed line, the damage pad, fight
 * controls) always shows, and the bottom tab bar switches the section below it. Desktop (≥ 1024 px): left column
 * = top section + conditions and wounds; middle = abilities; right = aspects, gear, professions, notes, journal,
 * history.
 */
export function SheetLayout({
  props,
  stickyBar,
  banner,
  top,
  history,
}: {
  props: SectionProps
  /** The sticky name / heart die / HP bar. */
  stickyBar: ReactNode
  /** The GM banner, or nothing. */
  banner: ReactNode
  /** Identity header, ability rows, the speed line and the damage pad, in that order. */
  top: ReactNode
  history: ReactNode
}) {
  const [tab, setTab] = useState<Tab>('sheet')
  const choose = (value: string) => {
    setTab(value as Tab)
    // "The bottom tab bar jumps to the section."
    document.getElementById('sheet-sections')?.scrollIntoView({ block: 'start' })
  }

  return (
    <>
      {stickyBar}
      {banner}
      <Tabs
        value={tab}
        onValueChange={choose}
        className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-5 pt-4 pb-6 md:px-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_minmax(0,20rem)] lg:items-start lg:gap-8 lg:pt-6"
      >
        <div className="flex flex-col gap-6">
          {top}
          <FightControls {...props} />
          <div id="sheet-sections" className="scroll-mt-32" />
          <TabsContent value="sheet" forceMount className={PANEL}>
            <RestMenu {...props} />
            <ConditionsSection {...props} />
            <WoundsSection {...props} />
          </TabsContent>
        </div>

        <TabsContent value="abilities" forceMount className={PANEL}>
          <AbilitiesSection {...props} />
        </TabsContent>

        <div className="flex flex-col gap-6">
          <TabsContent value="aspects" forceMount className={PANEL}>
            <AspectsSection {...props} />
            <RaceEffectsNote {...props} />
          </TabsContent>
          <TabsContent value="gear" forceMount className={PANEL}>
            <GearSection {...props} />
          </TabsContent>
          <TabsContent value="more" forceMount className={PANEL}>
            <ProfessionsSection {...props} />
            <NotesSection {...props} />
            <JournalSection {...props} />
            {history}
          </TabsContent>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          <TabsList aria-label="Sheet sections" className="mx-auto max-w-xl border-b-0">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="mt-0 mb-0 min-h-12 flex-1 border-t-2 border-b-0 px-1 data-[state=active]:border-primary"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
    </>
  )
}
