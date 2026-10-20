import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { removeEncounterFn, type SessionEncounter } from '~/server/campaign-play'
import { campaignWrite } from '../write'

/**
 * The encounters attached to a session (spec §7.3): each title links to its page on tools.heartrush.party, the URL the
 * server gives. The GM's **Remove** expands in place into **Remove it** / **Keep**; the encounter itself stays on tools.
 */
export function EncounterList({ campaignId, sessionId, encounters, isGm }: { campaignId: string; sessionId: string; encounters: SessionEncounter[]; isGm: boolean }) {
  return (
    <ul className="flex flex-col" aria-label="Encounters">
      {encounters.map((e) => (
        <EncounterItem key={e.encounterId} campaignId={campaignId} sessionId={sessionId} encounter={e} isGm={isGm} />
      ))}
    </ul>
  )
}

function EncounterItem({ campaignId, sessionId, encounter, isGm }: { campaignId: string; sessionId: string; encounter: SessionEncounter; isGm: boolean }) {
  const remove = useServerFn(removeEncounterFn)
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    const result = await campaignWrite('remove the encounter', () => remove({ data: { campaignId, sessionId, encounterId: encounter.encounterId } }))
    setBusy(false)
    if (!result.ok) return setError(result.text)
    void router.invalidate()
  }

  return (
    <li className="flex flex-col border-b border-border last:border-b-0">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        <a href={encounter.url} target="_blank" rel="noreferrer noopener" className="flex min-h-11 min-w-0 items-center text-ui text-primary underline underline-offset-4">
          <span className="truncate">{encounter.title}</span>
        </a>
        {isGm &&
          (confirming ? (
            <span className="flex items-center gap-2">
              <Button size="compact" type="button" variant="line" disabled={busy} onClick={() => void confirm()}>
                {busy ? 'Removing…' : 'Remove it'}
              </Button>
              <Button size="compact" type="button" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button size="compact" type="button" variant="ghost" aria-label={`Remove ${encounter.title}`} onClick={() => setConfirming(true)}>
              Remove
            </Button>
          ))}
      </div>
      {error && (
        <p role="alert" className="pb-2 text-ui text-muted-foreground">
          {error}
        </p>
      )}
    </li>
  )
}
