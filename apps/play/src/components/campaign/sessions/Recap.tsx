import { useId, useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { Textarea } from '@heartrush/ui/components/textarea'
import { JournalMarkdown } from '~/components/journal/JournalMarkdown'
import { MAX_RECAP_LENGTH, editRecapFn } from '~/server/campaign-play'
import { campaignWrite } from '../write'

/**
 * A session's recap (spec §2.2): the GM's Markdown, rendered. `expanded` starts it open (the newest session) or folded
 * behind **Show recap**. The GM's **Edit recap** (or **Write recap** when empty) expands in place into a textarea with
 * **Save** and **Cancel**; a saved recap reaches every open page through the campaign event `editRecapFn` publishes.
 */
export function Recap({ campaignId, sessionId, recap, isGm, expanded }: { campaignId: string; sessionId: string; recap: string; isGm: boolean; expanded: boolean }) {
  const edit = useServerFn(editRecapFn)
  const router = useRouter()
  const id = useId()
  const [shown, setShown] = useState(expanded)
  // When this session stops (or becomes) the newest, reset its default; a reader's toggle holds until then.
  const [wasExpanded, setWasExpanded] = useState(expanded)
  if (expanded !== wasExpanded) {
    setWasExpanded(expanded)
    setShown(expanded)
  }
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(recap)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    setText(recap)
    setError(null)
    setEditing(true)
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await campaignWrite('save the recap', () => edit({ data: { campaignId, sessionId, recap: text } }))
    setBusy(false)
    if (!result.ok) return setError(result.text)
    setEditing(false)
    setShown(true)
    void router.invalidate()
  }

  if (editing) {
    return (
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
        <label htmlFor={id} className="eyebrow">
          Recap
        </label>
        <Textarea
          id={id}
          autoFocus
          rows={8}
          maxLength={MAX_RECAP_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What happened this session? Markdown works: **bold**, *italic*, - lists, # headings."
        />
        <div className="flex gap-2">
          <Button type="submit" size="lg" disabled={busy || text === recap}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" size="lg" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-ui text-muted-foreground">
            {error}
          </p>
        )}
      </form>
    )
  }

  const empty = !recap.trim()
  return (
    <div className="flex flex-col gap-2">
      {empty ? (
        <p className="text-ui text-muted-foreground">No recap yet.</p>
      ) : shown ? (
        <JournalMarkdown source={recap} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!empty && (
          <Button type="button" variant="ghost" className="min-h-11" aria-expanded={shown} onClick={() => setShown((s) => !s)}>
            {shown ? 'Hide recap' : 'Show recap'}
          </Button>
        )}
        {isGm && (
          <Button type="button" variant="outline" className="min-h-11" onClick={start}>
            {empty ? 'Write recap' : 'Edit recap'}
          </Button>
        )}
      </div>
    </div>
  )
}
