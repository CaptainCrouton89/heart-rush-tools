import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { INVITE_DAYS, createInviteFn } from '~/server/campaigns'
import { campaignWrite } from './write'

/** GM only. **Invite link** makes a new seven-day link and shows it in place, read-only, with **Copy**. */
export function InviteLink({ campaignId }: { campaignId: string }) {
  const create = useServerFn(createInviteFn)
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const make = async () => {
    setBusy(true)
    setError(null)
    setCopied(false)
    const result = await campaignWrite('make an invite link', () => create({ data: { campaignId } }))
    setBusy(false)
    if (!result.ok) return setError(result.text)
    setLink(location.origin + result.value.path)
  }
  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setError("Couldn't copy: select the link and copy it by hand.")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {link ? (
        <>
          <label className="eyebrow" htmlFor="invite-link">
            Invite link · works for {INVITE_DAYS} days
          </label>
          <div className="flex items-center gap-2">
            <Input id="invite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="h-11 min-w-0 flex-1" />
            <Button size="compact" type="button" variant="line" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </>
      ) : (
        <Button size="compact" type="button" variant="line" className="self-start" disabled={busy} onClick={make}>
          {busy ? 'Making link…' : 'Invite link'}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-ui text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  )
}
