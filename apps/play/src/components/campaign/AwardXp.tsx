import { useId, useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { awardXpToCampaignFn, type CampaignCharacterCard } from '~/server/campaigns'
import { campaignWrite } from './write'

/**
 * GM only. **Award XP** expands in place into an amount field with **Award** and **Cancel** (no dialog); the amount goes
 * to every character in the campaign as one `xp:award` each. The line after it says who received it and who did not.
 */
export function AwardXp({ campaignId, characters }: { campaignId: string; characters: CampaignCharacterCard[] }) {
  const award = useServerFn(awardXpToCampaignFn)
  const router = useRouter()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [line, setLine] = useState<string | null>(null)
  const amount = /^\d+$/.test(text) ? Number(text) : 0

  const close = () => {
    setOpen(false)
    setText('')
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || amount < 1) return
    setBusy(true)
    setLine(null)
    const result = await campaignWrite('award XP', () => award({ data: { campaignId, amount } }))
    setBusy(false)
    if (!result.ok) return setLine(result.text)
    const { awarded, failed } = result.value
    const nameOf = (characterId: string) => characters.find((c) => c.id === characterId)?.name || 'a character'
    const parts = [awarded.length === 0 ? 'Nobody received XP.' : `Awarded ${amount} XP to ${awarded.length} character${awarded.length === 1 ? '' : 's'}.`]
    for (const f of failed) parts.push(`Not ${nameOf(f.characterId)}: ${f.message.replace(/\.$/, '')}.`)
    setLine(parts.join(' '))
    close()
    void router.invalidate()
  }

  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={id} className="eyebrow">
            XP for every character
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={id}
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="0"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Escape' && close()}
              className="h-11 w-24 text-center tabular-nums"
            />
            <Button type="submit" size="lg" disabled={busy || amount < 1}>
              {busy ? 'Awarding…' : 'Award'}
            </Button>
            <Button type="button" size="lg" variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" size="lg" variant="outline" className="self-start" disabled={characters.length === 0} onClick={() => setOpen(true)}>
          Award XP
        </Button>
      )}
      {line && (
        <p role="status" className="text-ui text-muted-foreground">
          {line}
        </p>
      )}
    </div>
  )
}
