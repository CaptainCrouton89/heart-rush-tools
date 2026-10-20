// The body shared by the desktop hover preview and the touch bottom sheet: breadcrumb, title, the bounded
// source excerpt (labelled "Excerpt" when the compiler cut it short), and the loading / failure states.
import { Link } from '@tanstack/react-router'
import type { LinkTarget, PreviewFile } from '@heartrush/content/types'
import { cn } from '@heartrush/ui/lib/utils'
import type { PreviewState } from './load-preview'

export function PreviewBreadcrumb({ preview }: { preview: PreviewFile }) {
  if (preview.breadcrumbs.length === 0) return null
  return <p className="font-sans text-meta text-muted-foreground">{preview.breadcrumbs.map((c) => c.title).join(' › ')}</p>
}

export function PreviewExcerpt({ preview, className }: { preview: PreviewFile; className?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {preview.truncated && <p className="eyebrow">Excerpt</p>}
      <p className={cn('font-serif text-foreground', className)}>{preview.excerptText}</p>
    </div>
  )
}

export function FullRuleLink({ target, className, onClick }: { target: LinkTarget; className?: string; onClick?: () => void }) {
  return (
    <Link
      to={target.path}
      hash={target.anchor ?? undefined}
      onClick={onClick}
      className={cn('font-sans text-ui font-medium text-primary underline underline-offset-4 hover:decoration-2', className)}
    >
      Read full rule →
    </Link>
  )
}

export function PreviewStatus({ state, target }: { state: Exclude<PreviewState, { status: 'ready' }>; target: LinkTarget }) {
  if (state.status === 'loading') return <p className="font-sans text-ui text-muted-foreground">Loading preview…</p>
  return (
    <p className="font-sans text-ui text-muted-foreground">
      Preview unavailable —{' '}
      <Link to={target.path} hash={target.anchor ?? undefined} className="text-primary underline underline-offset-4">
        open full rule
      </Link>
    </p>
  )
}
