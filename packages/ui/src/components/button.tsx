import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

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
      },
      size: {
        default: 'h-10 px-4 text-control',
        sm: 'h-8 rounded-sm px-3 text-ui',
        lg: 'h-11 px-5 text-control',
        icon: 'size-10',
        'icon-sm': 'size-8 rounded-sm',
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
