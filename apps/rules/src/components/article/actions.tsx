// "Copy link" and "Print / Save PDF" for the current article.
// Copy writes the canonical URL and announces "Link copied". When the clipboard is unavailable it shows the URL in a
// selected read-only field for manual copying. Print opens the browser's print dialog; print CSS removes the shell
// and controls, so the browser's PDF destination is the PDF feature.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { canonicalUrl, copyText } from './canonical'
import { LinkIcon, PrinterIcon } from './icons'

/** `children`: extra page-specific actions placed after Print in the same row. */
export function ArticleActions({ path, children }: { path: string; children?: ReactNode }) {
  const url = canonicalUrl(path)
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const fieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state === 'copied') {
      const timer = setTimeout(() => setState('idle'), 2500)
      return () => clearTimeout(timer)
    }
    if (state === 'manual') fieldRef.current?.select()
  }, [state])

  async function copy() {
    setState((await copyText(url)) ? 'copied' : 'manual')
  }

  return (
    <div className="print-hidden flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="max-lg:h-11" onClick={copy}>
          <LinkIcon />
          Copy link
        </Button>
        <Button variant="outline" size="sm" className="max-lg:h-11" onClick={() => window.print()}>
          <PrinterIcon />
          Print / Save PDF
        </Button>
        {children}
        <span role="status" className="text-meta text-muted-foreground">
          {state === 'copied' ? 'Link copied' : ''}
        </span>
      </div>
      {state === 'manual' && (
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          Copying is unavailable here. Copy this address:
          <input
            ref={fieldRef}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-10 w-full rounded-md border border-input bg-surface px-3 text-base text-foreground md:text-ui"
          />
        </label>
      )}
    </div>
  )
}
