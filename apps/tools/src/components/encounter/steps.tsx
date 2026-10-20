import { useState, type ComponentProps } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { cn } from '@heartrush/ui/lib/utils'
import type { Outline, Question } from '~/encounter/schema'

export const YOU_DECIDE = 'You decide'

/** A tappable suggested answer or quick reply. Wraps long text; at least 44px tall so it is easy to hit on a phone. */
export function Chip({
  selected,
  quiet,
  className,
  ...props
}: ComponentProps<'button'> & { selected?: boolean; /** "You decide" / "Other…": set apart from the real options. */ quiet?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'min-h-11 rounded-md border px-3 py-2 text-left font-sans text-ui transition-colors disabled:pointer-events-none disabled:opacity-50 lg:min-h-9 lg:py-1.5',
        selected
          ? 'border-primary bg-accent text-accent-foreground'
          : quiet
            ? 'border-dashed border-input bg-transparent text-muted-foreground hover:border-primary hover:text-foreground'
            : 'border-input bg-surface text-foreground hover:border-primary hover:bg-surface-muted',
        className,
      )}
      {...props}
    />
  )
}

/** One GM message holding every answer: "**Q:** … / **A:** …", an unanswered question answered "You decide". */
export const composeAnswers = (questions: Question[], answers: Record<string, string>) =>
  questions.map((q) => `**Q:** ${q.text}\n**A:** ${answers[q.id]?.trim() || YOU_DECIDE}`).join('\n\n')

/**
 * The agent's questions with their suggested answers. While the questions are the latest turn the GM picks one chip per
 * question (or types an answer) and sends them all as one message; earlier question rounds show as plain text.
 */
export function QuestionsStep({
  questions,
  active,
  onSend,
}: {
  questions: Question[]
  active: boolean
  onSend: (text: string) => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [typing, setTyping] = useState<Record<string, boolean>>({})
  if (!active) {
    return (
      <ol className="list-decimal space-y-1 pl-5 font-serif text-body-sm text-muted-foreground marker:text-muted-foreground">
        {questions.map((q) => (
          <li key={q.id}>{q.text}</li>
        ))}
      </ol>
    )
  }
  const answered = questions.filter((q) => answers[q.id]?.trim()).length
  const choose = (id: string, value: string) =>
    setAnswers((a) => ({ ...a, [id]: a[id] === value && !typing[id] ? '' : value }))

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSend(composeAnswers(questions, answers))
      }}
    >
      <ol className="space-y-5">
        {questions.map((q, i) => {
          const options = [...q.suggestions, YOU_DECIDE]
          const groupId = `q-${q.id}-${i}`
          return (
            <li key={q.id} className="space-y-2">
              <p id={groupId} className="font-serif text-body-sm font-semibold text-foreground">
                <span className="mr-1.5 font-sans text-ui text-muted-foreground tabular-nums">{i + 1}.</span>
                {q.text}
              </p>
              <div role="group" aria-labelledby={groupId} className="flex flex-wrap gap-2">
                {options.map((option) => (
                  <Chip
                    key={option}
                    quiet={option === YOU_DECIDE}
                    selected={!typing[q.id] && answers[q.id] === option}
                    onClick={() => {
                      setTyping((t) => ({ ...t, [q.id]: false }))
                      choose(q.id, option)
                    }}
                  >
                    {option}
                  </Chip>
                ))}
                <Chip
                  quiet
                  selected={typing[q.id]}
                  onClick={() => {
                    setTyping((t) => ({ ...t, [q.id]: !t[q.id] }))
                    setAnswers((a) => ({ ...a, [q.id]: '' }))
                  }}
                >
                  Other…
                </Chip>
              </div>
              {typing[q.id] && (
                <Input
                  autoFocus
                  aria-label={`Your answer to: ${q.text}`}
                  placeholder="Type your answer"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit">Send answers</Button>
        <p className="text-meta text-muted-foreground">
          {answered === questions.length
            ? 'All answered.'
            : `${answered} of ${questions.length} answered. The rest go as “${YOU_DECIDE}”.`}
        </p>
      </div>
    </form>
  )
}

/** The proposed encounter, compactly: roster with counts and roles, terrain, difficulty. */
export function OutlineView({ outline }: { outline: Outline }) {
  return (
    <div className="space-y-3 border-l-2 border-border pl-4 font-serif text-body-sm">
      <ul className="space-y-2">
        {outline.enemies.map((enemy, i) => (
          <li key={i}>
            <span className="font-semibold">
              <span className="font-sans tabular-nums">{enemy.count} ×</span> {enemy.name}
            </span>{' '}
            <span className="font-sans text-meta uppercase tracking-wide text-muted-foreground">{enemy.role}</span>
            <span className="block text-muted-foreground">{enemy.concept}</span>
          </li>
        ))}
      </ul>
      {outline.terrain.length > 0 && (
        <div>
          <p className="eyebrow">Terrain</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 marker:text-muted-foreground">
            {outline.terrain.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <p>
        <span className="eyebrow mr-2">Difficulty</span>
        {outline.difficulty}
      </p>
    </div>
  )
}

/** Quick replies the agent offered (outline approval, tweaks). One tap sends the reply. With `primaryFirst` the first reply ("Build it") is the main button. */
export function QuickReplies({
  replies,
  onSend,
  label,
  primaryFirst,
}: {
  replies: string[]
  onSend: (text: string) => void
  label: string
  primaryFirst?: boolean
}) {
  if (replies.length === 0) return null
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {replies.map((reply, i) =>
        primaryFirst && i === 0 ? (
          <Button key={reply} onClick={() => onSend(reply)} className="h-11 lg:h-10">
            {reply}
          </Button>
        ) : (
          <Chip key={reply} onClick={() => onSend(reply)}>
            {reply}
          </Chip>
        ),
      )}
    </div>
  )
}
