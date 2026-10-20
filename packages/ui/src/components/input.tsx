import * as React from 'react'
import { cn } from '../lib/utils'

/** Text field with the `input` boundary colour. 16px text below 768px so iOS does not zoom on focus; 14px UI size above. */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-10 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 font-sans text-base text-foreground transition-colors md:text-ui',
        'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:font-medium',
        'aria-invalid:border-warning',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
