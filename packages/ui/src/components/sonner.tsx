import { Toaster as Sonner, toast, type ToasterProps as SonnerProps } from 'sonner'
import { Check, CircleAlert, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react'

/**
 * Toast region (Sonner). Render once near the app root; raise toasts with `toast(...)` from this module.
 * Toasts are inverted chips (foreground on background colours, like the tooltip), bordered-free and
 * shadowless; the action button (e.g. "Undo") and close button are 44px tap targets. Sonner's own
 * colour styling is off (`unstyled`), so `theme`, `richColors` and `invert` are not accepted.
 */
type ToasterProps = Omit<SonnerProps, 'theme' | 'richColors' | 'invert'>

function Toaster({ position = 'bottom-center', toastOptions, icons, ...props }: ToasterProps) {
  return (
    <Sonner
      data-slot="toaster"
      position={position}
      icons={{
        success: <Check aria-hidden="true" />,
        info: <Info aria-hidden="true" />,
        warning: <TriangleAlert aria-hidden="true" />,
        error: <CircleAlert aria-hidden="true" />,
        loading: <LoaderCircle aria-hidden="true" className="animate-spin" />,
        close: <X aria-hidden="true" />,
        ...icons,
      }}
      toastOptions={{
        ...toastOptions,
        unstyled: true,
        classNames: {
          toast:
            'flex w-(--width) items-center gap-3 rounded-md bg-foreground py-1 pr-1 pl-4 font-sans text-ui text-background',
          content: 'flex min-w-0 flex-1 flex-col gap-0.5 py-2',
          title: 'font-medium',
          description: 'text-meta opacity-80',
          icon: 'flex shrink-0 items-center',
          actionButton:
            'inline-flex min-h-11 shrink-0 items-center rounded-sm px-3 text-control font-semibold underline underline-offset-4 hover:bg-background/15 focus-visible:-outline-offset-2',
          cancelButton:
            'inline-flex min-h-11 shrink-0 items-center rounded-sm px-3 text-control font-medium hover:bg-background/15 focus-visible:-outline-offset-2',
          closeButton:
            'order-last inline-flex size-11 shrink-0 items-center justify-center rounded-sm hover:bg-background/15 focus-visible:-outline-offset-2',
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast, type ToasterProps }
