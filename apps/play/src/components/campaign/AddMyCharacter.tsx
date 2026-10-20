import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { assignCharacterToCampaignFn } from '~/server/campaigns'
import type { CharacterSummary } from '~/server/characters'
import { campaignWrite } from './write'

/**
 * **Add my character to this campaign** (Key flow 8): expands in place into the viewer's finished characters that are
 * in no campaign; tapping one adds it. With none to add, it says why instead of showing the button.
 */
export function AddMyCharacter({ campaignId, candidates }: { campaignId: string; candidates: CharacterSummary[] }) {
  const assign = useServerFn(assignCharacterToCampaignFn)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const add = async (characterId: string) => {
    setBusy(characterId)
    setError(null)
    const result = await campaignWrite('add the character', () => assign({ data: { characterId, campaignId } }))
    setBusy(null)
    if (!result.ok) return setError(result.text)
    setOpen(false)
    await router.invalidate()
  }

  if (candidates.length === 0) {
    return (
      <p className="text-ui text-muted-foreground">
        You have no finished character to add: a character can be in one campaign at a time.{' '}
        <a href="/characters" className="text-primary underline underline-offset-4">
          Your characters
        </a>
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
          <p className="eyebrow">Add which character?</p>
          <ul className="flex flex-col gap-1">
            {candidates.map((c) => (
              <li key={c.id}>
                <Button size="compact"
                  type="button"
                  variant="ghost"
                  className="w-full justify-between"
                  disabled={busy !== null}
                  onClick={() => add(c.id)}
                >
                  <span className="truncate">{c.name || 'Unnamed character'}</span>
                  <span className="shrink-0 text-ui text-muted-foreground">{busy === c.id ? 'Adding…' : c.raceTitle}</span>
                </Button>
              </li>
            ))}
          </ul>
          <Button size="compact" type="button" variant="ghost" className="self-start" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="compact" type="button" variant="line" className="self-start" onClick={() => setOpen(true)}>
          Add my character to this campaign
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
