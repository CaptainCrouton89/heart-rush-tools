// Fetches one compiled preview artifact on demand. Each preview is requested at most once per content version:
// the in-flight promise is shared and a resolved file is kept for synchronous reads. A failed request is not
// kept, so reopening the preview tries again.
import { useEffect, useState } from 'react'
import type { PreviewFile } from '@heartrush/content/types'

const inflight = new Map<string, Promise<PreviewFile>>()
const resolved = new Map<string, PreviewFile>()

function previewUrl(contentVersion: string, previewId: string) {
  return `/_content/${contentVersion}/previews/${encodeURIComponent(previewId)}.json`
}

function loadPreview(contentVersion: string, previewId: string): Promise<PreviewFile> {
  const url = previewUrl(contentVersion, previewId)
  let request = inflight.get(url)
  if (!request) {
    request = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`preview ${previewId}: HTTP ${response.status}`)
      const file = (await response.json()) as PreviewFile
      resolved.set(url, file)
      return file
    })
    request.catch(() => inflight.delete(url))
    inflight.set(url, request)
  }
  return request
}

export type PreviewState = { status: 'loading' } | { status: 'ready'; preview: PreviewFile } | { status: 'error' }

/** Loads the preview while `active` is true; returns the loading, ready or failed state. */
export function usePreview(contentVersion: string, previewId: string, active: boolean): PreviewState {
  const cached = resolved.get(previewUrl(contentVersion, previewId))
  const [state, setState] = useState<PreviewState>(cached ? { status: 'ready', preview: cached } : { status: 'loading' })

  useEffect(() => {
    if (!active) return
    let current = true
    const hit = resolved.get(previewUrl(contentVersion, previewId))
    if (hit) {
      setState({ status: 'ready', preview: hit })
      return
    }
    setState({ status: 'loading' })
    loadPreview(contentVersion, previewId).then(
      (preview) => current && setState({ status: 'ready', preview }),
      () => current && setState({ status: 'error' }),
    )
    return () => {
      current = false
    }
  }, [active, contentVersion, previewId])

  return state
}
