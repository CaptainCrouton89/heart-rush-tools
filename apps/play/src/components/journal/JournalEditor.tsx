import { useId, useState, type FormEvent } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Textarea } from '@heartrush/ui/components/textarea'

/**
 * The form for a new entry or an edit: a Markdown textarea with Save and Cancel. `onSave` resolves to an error text to
 * show under the field, or null when the entry saved (the parent then closes the form).
 */
export function JournalEditor({
  initial = '',
  label,
  saveLabel,
  onSave,
  onCancel,
}: {
  initial?: string
  label: string
  saveLabel: string
  onSave: (body: string) => Promise<string | null>
  onCancel: () => void
}) {
  const id = useId()
  const [body, setBody] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim() || saving) return
    setSaving(true)
    setError(await onSave(body))
    setSaving(false)
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Textarea
        id={id}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        autoFocus
        placeholder="What happened? Markdown works: **bold**, *italic*, - lists, # headings."
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <p id={`${id}-error`} role="alert" className="text-ui text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="compact" variant="line-primary" type="submit" disabled={!body.trim() || saving || body === initial}>
          {saving ? 'Saving…' : saveLabel}
        </Button>
        <Button size="compact" type="button" variant="line" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
