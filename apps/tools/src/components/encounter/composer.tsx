import { useRef, useState } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Textarea } from '@heartrush/ui/components/textarea'
import { cn } from '@heartrush/ui/lib/utils'

/**
 * The message box. On a keyboard, Enter sends and Shift+Enter starts a new line; on a touch screen Enter is a new line
 * and the Send button sends. `disabled` keeps what was typed.
 */
export function Composer({
  onSend,
  disabled,
  placeholder,
  label,
  size = 'chat',
  initial = '',
  sendLabel = 'Send',
}: {
  onSend: (text: string) => void | Promise<void>
  disabled?: boolean
  placeholder: string
  label: string
  size?: 'chat' | 'large'
  initial?: string
  sendLabel?: string
}) {
  const [text, setText] = useState(initial)
  const ref = useRef<HTMLTextAreaElement>(null)
  const canSend = !disabled && text.trim().length > 0

  function submit() {
    if (!canSend) return
    const value = text.trim()
    setText('')
    void onSend(value)
  }

  return (
    <form
      className={cn('flex gap-2', size === 'large' ? 'flex-col' : 'items-end')}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label className="sr-only" htmlFor={`composer-${size}`}>
        {label}
      </label>
      <Textarea
        id={`composer-${size}`}
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
          if (window.matchMedia('(pointer: coarse)').matches && !(e.metaKey || e.ctrlKey)) return
          e.preventDefault()
          submit()
        }}
        enterKeyHint="send"
        placeholder={placeholder}
        disabled={disabled}
        rows={size === 'large' ? 5 : 2}
        className={cn(
          'resize-none',
          size === 'large' ? 'min-h-36 font-serif text-body-sm md:text-body' : 'max-h-48 min-h-11 field-sizing-content',
        )}
      />
      <Button type="submit" disabled={!canSend} className={cn(size === 'large' ? 'self-end' : 'h-11')}>
        {sendLabel}
      </Button>
    </form>
  )
}
