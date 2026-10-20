import * as React from 'react'
import { cn } from '../lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 font-sans text-base text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-ui',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
