import { Input } from '@heartrush/ui/components/input'
import { rulebookUrl } from '~/catalogue'
import { ExplainAspectButton } from '~/components/ai/ExplainButton'
import { Section } from '~/components/sheet/SheetLayout'
import { sketchCharacter } from './draft-rules'
import type { UseDraft } from './use-draft'

const GOOD_ASPECT_PATH = '/player/building-your-character#what-makes-a-good-aspect'

/**
 * Step 5 (Creating your Aspects): the aspects the character already has from race and age, locked, and the two the
 * player writes, with the rulebook's "What Makes a Good Aspect" guidance inline. **Explain this aspect** (ruling 14) sits on
 * each row once the draft builds (`preview.character`) and is saved: the server explains the stored draft through `previewDraft`,
 * and the aspect ids come from that same preview. A written aspect's button is keyed by its text, so editing the text
 * drops an explanation of the old wording.
 */
export function StepAspects({ draft }: { draft: UseDraft }) {
  const { builder, update } = draft
  // Only while the screen matches the stored draft, which is what the server explains.
  const built = draft.status.kind === 'saved' ? (draft.preview.character?.aspects ?? null) : null
  const written = built?.filter((a) => a.source === 'created') ?? []
  const granted = (sketchCharacter(builder)?.aspects ?? []).filter((a) => a.source !== 'created')
  const write = (i: 0 | 1, text: string) =>
    update((b) => ({ ...b, createdAspects: i === 0 ? [text, b.createdAspects[1]] : [b.createdAspects[0], text] }))

  return (
    <div className="flex flex-col gap-8">
      <Section title="Aspects you have">
        {granted.length === 0 ? (
          <p className="text-ui text-muted-foreground">None from race or age.</p>
        ) : (
          <ul className="flex flex-col">
            {granted.map((a) => (
              <li key={a.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-border text-control">
                <span>{a.text}</span>
                <span className="flex shrink-0 items-center gap-1 text-meta text-muted-foreground">
                  {a.source === 'race' ? 'Race' : 'Age'} · rank {a.rank} · locked
                  {built?.some((b) => b.id === a.id && b.text === a.text) && <ExplainAspectButton characterId={draft.id} aspectId={a.id} text={a.text} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Two aspects you write">
        <div className="flex flex-col gap-3">
          {([0, 1] as const).map((i) => {
            const aspect = written[i]
            return (
              <div key={i} className="flex items-center gap-1">
                <Input
                  aria-label={`Aspect ${i + 1}`}
                  className="h-11"
                  placeholder={i === 0 ? 'Chronic insomniac' : 'Kleptomaniac'}
                  value={builder.createdAspects[i]}
                  onChange={(e) => write(i, e.target.value)}
                />
                {aspect && <ExplainAspectButton key={`${aspect.id}:${aspect.text}`} characterId={draft.id} aspectId={aspect.id} text={aspect.text} />}
              </div>
            )
          })}
          <p className="text-meta text-muted-foreground">Each starts at rank 1.</p>
        </div>
      </Section>

      <aside aria-label="What makes a good aspect" className="flex flex-col gap-3 rounded-md border border-border bg-surface-muted p-4 text-body-sm">
        <h2 className="eyebrow">What makes a good aspect</h2>
        <p>Effective aspects are:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Double-edged:</strong> can help in some situations but cause problems in others
          </li>
          <li>
            <strong>Specific enough to be interesting:</strong> “Chronic insomniac” rather than “sometimes tired”
          </li>
          <li>
            <strong>Personal and meaningful:</strong> connected to your character&rsquo;s story and goals
          </li>
          <li>
            <strong>Actionable:</strong> clear when and how they might apply
          </li>
        </ul>
        <p>Avoid these common pitfalls:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Too broad:</strong> “Good at everything” or “Lucky” apply everywhere and become generic
          </li>
          <li>
            <strong>Only positive:</strong> “Brilliant tactician” with no downside gives you no way to earn DP
          </li>
          <li>
            <strong>Too narrow:</strong> “Afraid of blue flowers” rarely comes up in most adventures
          </li>
          <li>
            <strong>Purely mechanical:</strong> “Gets +2 to sword fighting” lacks narrative interest
          </li>
          <li>
            <strong>Professional skills:</strong> your profession already covers your professional abilities
          </li>
        </ul>
        <a href={rulebookUrl(GOOD_ASPECT_PATH)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
          Read in rulebook ↗
        </a>
      </aside>
    </div>
  )
}
