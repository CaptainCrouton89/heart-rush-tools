import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/** Custom theme keys from styles.css, registered so `cn` resolves conflicts between them correctly
    (otherwise `text-control` is mistaken for a colour and removes `text-primary-foreground`). */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'body',
        'body-sm',
        'h1',
        'h1-sm',
        'h2',
        'h2-sm',
        'h3',
        'h4',
        'ui',
        'control',
        'meta',
        'table',
        'wordmark',
        'home-title',
      ],
      shadow: ['overlay'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
