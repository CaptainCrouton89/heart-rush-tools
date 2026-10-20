import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const TAP = 'relative after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[""]'
const TAP_44 = `${TAP} after:h-[max(100%,44px)] after:w-[max(100%,44px)]`
const TAP_48 = `${TAP} after:h-[max(100%,48px)] after:w-[max(100%,48px)]`

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-sans font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-border bg-surface text-foreground hover:bg-surface-muted',
        secondary: 'bg-surface-muted text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-foreground hover:bg-surface-muted',
        link: 'h-auto px-0 text-primary underline underline-offset-4 hover:decoration-2',
        /* Outline only, no fill: a thin `edge` line, or the primary colour for the main action. */
        line: 'border border-edge bg-transparent text-foreground hover:bg-surface-muted/60',
        'line-primary': 'border border-primary bg-transparent text-primary hover:bg-accent/40',
      },
      size: {
        default: 'h-10 px-4 text-control',
        sm: 'h-8 rounded-sm px-3 text-ui',
        lg: 'h-11 px-5 text-control',
        icon: 'size-10',
        'icon-sm': 'size-8 rounded-sm',
        /* Compact sizes draw a small button but keep a full tap area: an invisible ::after box centred on the
           button, at least 44 × 44 px (48 × 48 px for `compact-lg`), so a finger can miss the drawn edge. */
        compact: `${TAP_44} h-[30px] min-w-[30px] rounded-sm px-[9px] text-meta`,
        'compact-lg': `${TAP_48} h-9 min-w-9 rounded-sm px-3 text-meta`,
        'compact-icon': `${TAP_44} size-[30px] rounded-full p-0 text-[17px]`,
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
