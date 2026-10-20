import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

/** Inline status message. `destructive` uses the warning token: the palette has no separate error red. */
const alertVariants = cva('relative w-full rounded-md border-l-[3px] bg-surface-muted px-4 py-3 text-ui text-foreground', {
  variants: {
    variant: {
      default: 'border-l-note',
      destructive: 'border-l-warning',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-title" className={cn('mb-1 font-semibold', className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('text-ui', className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
