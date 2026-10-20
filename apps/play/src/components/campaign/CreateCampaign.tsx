import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { MAX_NAME_LENGTH, createCampaignFn } from '~/server/campaigns'
import { campaignWrite } from './write'

/**
 * **Create campaign**: the button expands in place into a name field with **Create** and **Cancel** (no dialog). A
 * created campaign opens straight away; the creator is its GM.
 */
export function CreateCampaign() {
  const create = useServerFn(createCampaignFn)
  const navigate = useNavigate()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setName('')
    setError(null)
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    const result = await campaignWrite('create the campaign', () => create({ data: { name: name.trim() } }))
    setBusy(false)
    if (!result.ok) return setError(result.text)
    await navigate({ to: '/campaigns/$id', params: { id: result.value.campaignId } })
  }

  if (!open) {
    return (
      <Button size="compact" variant="line-primary" type="button" className="self-start" onClick={() => setOpen(true)}>
        Create campaign
      </Button>
    )
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <label htmlFor={id} className="eyebrow">
        Campaign name
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          autoFocus
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && close()}
          className="h-11 min-w-0 flex-1 basis-56"
        />
        <Button size="compact" variant="line-primary" type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create'}
        </Button>
        <Button size="compact" type="button" variant="ghost" onClick={close}>
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
