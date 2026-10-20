import * as React from 'react'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import { cn } from '../lib/utils'

/**
 * Segmented control: one bordered strip of 44px items, the pressed item filled with the accent tint.
 * Pass `type="single"` (one value, e.g. minor / major / weekly / monthly) or `type="multiple"`.
 */
function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(
        'inline-flex w-fit items-stretch overflow-hidden rounded-md border border-input bg-surface',
        className,
      )}
      {...props}
    />
  )
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'inline-flex min-h-11 min-w-11 flex-1 items-center justify-center gap-2 border-l border-border px-3 font-sans text-ui font-medium whitespace-nowrap text-muted-foreground transition-colors first:border-l-0 focus-visible:-outline-offset-2',
        'hover:bg-surface-muted hover:text-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
        'disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none',
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
