import type { SessionView, SessionXpAward } from '~/server/campaign-play'
import { EncounterList } from './EncounterList'
import { LocalDate } from './LocalTime'
import { Recap } from './Recap'
import { SharedEntryList } from './SharedEntry'

/**
 * "XP awarded: 3 (3 each)". Each award gave its amount to every character, so the first number is what each character
 * received over the session and the brackets list the awards: two awards of 3 and 2 read "XP awarded: 5 (3 + 2 each)".
 */
export function xpLine(awards: SessionXpAward[]): string {
  const total = awards.reduce((sum, a) => sum + a.amount, 0)
  return `XP awarded: ${total} (${awards.map((a) => a.amount).join(' + ')} each)`
}

/** "Days 4–7", "Day 4" when it started and ended on one day, "From day 4" while open. */
function dayRange(s: SessionView): string {
  if (s.endDay === null) return `From day ${s.startDay}`
  return s.endDay === s.startDay ? `Day ${s.startDay}` : `Days ${s.startDay}–${s.endDay}`
}

/**
 * One session in the log (spec §2.2): number, real date, in-game days and whether it is open; the recap; the XP awarded
 * while it was open; the encounters attached to it; and the shared journal entries written during it.
 */
export function SessionEntry({ campaignId, session: s, isGm, newest }: { campaignId: string; session: SessionView; isGm: boolean; newest: boolean }) {
  return (
    <article aria-labelledby={`session-${s.id}`} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={`session-${s.id}`} className="font-serif text-h4 font-semibold">
          Session {s.number}
          {s.open && <span className="ml-2 align-middle font-sans text-meta font-semibold text-primary uppercase">Open</span>}
        </h3>
        <p className="text-meta text-muted-foreground tabular-nums">
          <LocalDate date={s.realDate} /> · {dayRange(s)}
        </p>
      </header>

      <Recap key={s.id} campaignId={campaignId} sessionId={s.id} recap={s.recap} isGm={isGm} expanded={newest} />

      {s.xpAwards.length > 0 && <p className="text-ui tabular-nums">{xpLine(s.xpAwards)}</p>}

      {s.encounters.length > 0 && (
        <section className="flex flex-col gap-1">
          <h4 className="eyebrow">Encounters</h4>
          <EncounterList campaignId={campaignId} sessionId={s.id} encounters={s.encounters} isGm={isGm} />
        </section>
      )}

      {s.journal.length > 0 && (
        <section className="flex flex-col gap-1">
          <h4 className="eyebrow">Journal entries</h4>
          <SharedEntryList entries={s.journal} />
        </section>
      )}
    </article>
  )
}
