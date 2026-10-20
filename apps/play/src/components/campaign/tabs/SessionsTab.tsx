import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { SessionEntry } from '~/components/campaign/sessions/SessionEntry'
import { SharedEntryList } from '~/components/campaign/sessions/SharedEntry'
import type { SharedJournalEntry } from '~/server/journal'
import type { CampaignDetail } from '~/server/campaigns'
import { endSessionFn, startSessionFn, type SessionView } from '~/server/campaign-play'

/**
 * The Sessions tab (spec §2.2). P2 mounts it as the campaign page's "Sessions" panel. The page's loader reads
 * `listSessionsFn` and refetches it on every live event, so the props are always current: a write here only calls its
 * server function (which publishes) and `router.invalidate()` for its own page.
 *
 * The GM gets **Start session** and, while one is open, **End session N**. A refused start shows the server's text as it
 * is returned ("End session 1 first"). Sessions are newest first, the newest with its recap expanded; shared journal
 * entries written with no session open are listed under "Between sessions". Only shared entries arrive here (INV-PRIVATE).
 */
export type SessionsTabProps = {
  /** The campaign as the page's loader returned it (`id`, `role`, `currentDay`, `members`, `characters`). */
  campaign: CampaignDetail
  /** `listSessionsFn().sessions`: newest first. */
  sessions: SessionView[]
  /** `listSessionsFn().betweenSessions`: shared journal entries written with no session open. */
  betweenSessions: SharedJournalEntry[]
}

export function SessionsTab({ campaign, sessions, betweenSessions }: SessionsTabProps) {
  const isGm = campaign.role === 'gm'
  return (
    <div className="flex flex-col gap-4">
      {isGm && <SessionControls campaignId={campaign.id} open={sessions.find((s) => s.open) ?? null} />}
      {sessions.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">{isGm ? 'No sessions yet. Start one when play begins.' : 'No sessions yet.'}</p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Sessions, newest first">
          {sessions.map((s, i) => (
            <li key={s.id}>
              <SessionEntry campaignId={campaign.id} session={s} isGm={isGm} newest={i === 0} />
            </li>
          ))}
        </ol>
      )}
      {betweenSessions.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="eyebrow border-b border-border pb-2">Between sessions</h3>
          <SharedEntryList entries={betweenSessions} />
        </section>
      )}
    </div>
  )
}

/** Today in the GM's own calendar, YYYY-MM-DD (the server's default is today in UTC). */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function SessionControls({ campaignId, open }: { campaignId: string; open: SessionView | null }) {
  const start = useServerFn(startSessionFn)
  const end = useServerFn(endSessionFn)
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [line, setLine] = useState<string | null>(null)

  /** Shows a refusal's text as the server returned it; a request that never answered gets the connection line. */
  const run = async (write: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    setBusy(true)
    setLine(null)
    try {
      const result = await write()
      if (!result.ok) setLine(result.message)
      else void router.invalidate()
    } catch (e) {
      console.error('session write failed', e)
      setLine(e instanceof TypeError ? 'Not saved — no connection.' : 'Not saved — something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="compact" variant="line-primary" type="button" disabled={busy} onClick={() => void run(() => start({ data: { campaignId, realDate: localToday() } }))}>
          Start session
        </Button>
        {open && (
          <Button size="compact" type="button" variant="line" disabled={busy} onClick={() => void run(() => end({ data: { campaignId, sessionId: open.id } }))}>
            End session {open.number}
          </Button>
        )}
      </div>
      {line && (
        <p role="alert" className="text-ui text-muted-foreground">
          {line}
        </p>
      )}
    </div>
  )
}
