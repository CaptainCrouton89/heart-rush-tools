import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { hpColorClass } from '~/components/sheet/StickyBar'
import { removeCharacterFromCampaignFn, type CampaignCharacterCard } from '~/server/campaigns'
import { campaignWrite } from './write'

/** The bar's fill for each HP text colour (written out so Tailwind sees every class). */
const BAR: Record<string, string> = { 'text-hp': 'bg-hp', 'text-warning': 'bg-warning', 'text-primary': 'bg-primary' }

/**
 * One character on the campaign page (design "Campaign page and GM view"): name, player, an HP bar
 * `current/effective max` in the sheet's HP colours, heart die, wound count and the active conditions as chips. The card
 * opens the sheet; the sheet decides who may edit (the owner and the GM). `notes` are the GM assistant's notes for this
 * character, shown under the card. `mine`: the viewer owns it, so the card offers **Remove from campaign** (owner only,
 * as the server enforces).
 */
export function CharacterCard({ character: c, notes, mine }: { character: CampaignCharacterCard; notes: string[]; mine: boolean }) {
  const { current, effectiveMax } = c.hp
  const filled = effectiveMax > 0 ? Math.min(100, Math.max(0, (current / effectiveMax) * 100)) : 0
  const color = hpColorClass(current, effectiveMax)
  const bar = BAR[color]
  return (
    <div className="flex flex-col gap-2">
      <a
        href={`/characters/${c.id}`}
        className="flex min-h-11 flex-col gap-3 rounded-md border border-border bg-surface p-4 text-foreground transition-colors hover:border-muted-foreground hover:bg-surface-muted"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate font-serif text-h4 font-semibold">{c.name || 'Unnamed character'}</span>
            <span className="block truncate text-ui text-muted-foreground">
              {c.ownerName} · {c.raceTitle}
            </span>
          </span>
          <span className="shrink-0 font-sans text-control font-semibold tabular-nums" aria-label={`Heart die d${c.heartDie.current}`}>
            d{c.heartDie.current} <span aria-hidden="true" className="text-primary">♥</span>
          </span>
        </span>
        <span className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3 font-sans tabular-nums" aria-label={`HP ${current} of ${effectiveMax}`}>
            <span>
              <span className={`text-control font-semibold ${color}`}>{current}</span>
              <span className="text-ui text-muted-foreground"> / {effectiveMax} HP</span>
            </span>
            <span className="text-ui text-muted-foreground">
              {c.woundCount} wound{c.woundCount === 1 ? '' : 's'}
            </span>
          </span>
          <span aria-hidden="true" className="block h-2 overflow-hidden rounded-sm bg-surface-muted">
            <span className={`block h-full ${bar}`} style={{ width: `${filled}%` }} />
          </span>
        </span>
        {c.conditions.length > 0 && (
          <span className="flex flex-wrap gap-1.5" aria-label="Conditions">
            {c.conditions.map((k) => (
              <span key={k.id} className="rounded-sm border border-border bg-surface-muted px-2 py-0.5 text-meta font-medium">
                {k.title}
                {k.level !== null && <span className="tabular-nums"> {k.level}</span>}
                {k.permanent && <span className="text-muted-foreground"> · permanent</span>}
              </span>
            ))}
          </span>
        )}
      </a>
      {mine && <RemoveFromCampaign characterId={c.id} name={c.name || 'this character'} />}
      {notes.map((note, i) => (
        <p key={i} className="border-l-2 border-primary pl-3 text-ui whitespace-pre-line">
          <span className="eyebrow mr-2">GM assistant</span>
          {note}
        </p>
      ))}
    </div>
  )
}

/**
 * Takes the viewer's character out of the campaign, in place: the first tap asks, the second removes. The server
 * publishes the change, so every open page of the campaign drops the card.
 */
function RemoveFromCampaign({ characterId, name }: { characterId: string; name: string }) {
  const remove = useServerFn(removeCharacterFromCampaignFn)
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    const result = await campaignWrite('remove the character', () => remove({ data: { characterId } }))
    setBusy(false)
    if (!result.ok) return setError(result.text)
    setAsking(false)
    await router.invalidate()
  }

  return (
    <div className="flex flex-col gap-1">
      {asking ? (
        <div className="flex flex-wrap items-center gap-x-2 text-ui">
          <span className="min-w-0">Remove {name} from this campaign?</span>
          <Button type="button" variant="ghost" size="sm" className="min-h-11 text-primary" disabled={busy} onClick={confirm}>
            {busy ? 'Removing…' : 'Remove'}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={busy} onClick={() => setAsking(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="min-h-11 self-start text-muted-foreground" onClick={() => setAsking(true)}>
          Remove from campaign
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
