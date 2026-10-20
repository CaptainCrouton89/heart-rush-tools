import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Alert, AlertDescription } from '@heartrush/ui/components/alert'
import { Button } from '@heartrush/ui/components/button'
import { finishDraftFn } from '~/server/characters'
import { NO_CONNECTION_TEXT, refusalReason } from '~/components/sheet/refusal-text'
import type { UseDraft } from './use-draft'

/**
 * **Finish** on step 7: saves the draft, then `finishDraft` writes the character and one event per pending action, and
 * the sheet opens. Disabled, with the reason beside it, while the builder is incomplete or any pending action is
 * refused (ruling 8; the refused rows and their Remove buttons are listed above the step).
 */
export function FinishBar({ draft }: { draft: UseDraft }) {
  const finish = useServerFn(finishDraftFn)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { builderError, invalid } = draft.preview
  const blockedBy = builderError
    ? `An earlier step is incomplete: ${refusalReason(builderError.code, builderError.message)}`
    : invalid.length > 0
      ? `Remove the ${invalid.length === 1 ? 'change' : `${invalid.length} changes`} no longer allowed (listed at the top) to finish.`
      : null

  async function onFinish() {
    setBusy(true)
    setError(null)
    try {
      const saved = await draft.flush()
      if (!saved) return
      const result = await finish({ data: { characterId: draft.id, revision: saved.revision } })
      if (!result.ok) {
        setError(`Not finished: ${result.invalid?.map((i) => refusalReason(i.code, i.message)).join('; ') || refusalReason(result.code, result.message)}`)
        return
      }
      await navigate({ href: `/characters/${draft.id}` })
    } catch {
      setError(NO_CONNECTION_TEXT)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" disabled={blockedBy !== null || busy} onClick={onFinish}>
          {busy ? 'Finishing…' : 'Finish'}
        </Button>
        {blockedBy && (
          <p className="text-ui text-muted-foreground" aria-live="polite">
            {blockedBy}
          </p>
        )}
      </div>
    </div>
  )
}
