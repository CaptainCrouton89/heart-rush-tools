// The GM assistant (design "AI features" 3): GM only. The question box, the three suggested questions, Thinking…, the
// answer, and the per-character notes, which the campaign page shows under each character's card. Nothing is saved
// (INV-AI): the answer lives in this page's memory until the next question or a reload. The panel rendering only for
// the GM is presentation; `runAi` refuses a player or an outsider before reading anything (INV-AUTHZ).
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Textarea } from '@heartrush/ui/components/textarea'
import { AiFailureLine, Thinking, type AiProblem } from '~/components/ai/AiFailure'
import { useAi, type AiState } from '~/components/ai/use-ai'
import { MAX_QUESTION_LENGTH } from '~/server/ai'
import type { GmAssistantValue } from '~/server/ai-prompts'
import type { CampaignCharacterCard } from '~/server/campaigns'

export const SUGGESTED_QUESTIONS = [
  'Who is closest to going down?',
  'Which aspects could I invoke against them this scene?',
  'Summarize what each character can still do this fight',
] as const

const key = (name: string) => name.trim().toLowerCase()

export type GmAssistant = {
  question: string
  setQuestion: (q: string) => void
  /** Asks `question` (or `q`, which also fills the box). */
  ask: (q?: string) => void
  state: AiState<GmAssistantValue>
  /** The current answer's notes for one card, matched on the character's name; none when two cards share that name. */
  notesFor: (characterName: string) => string[]
  /** Notes naming no character on the page, or a name two cards share; the panel shows these itself. */
  unmatched: { characterName: string; note: string }[]
}

/** The assistant's state, held by the campaign page so the cards and the panel read the same answer. */
export function useGmAssistant(campaignId: string, characters: CampaignCharacterCard[]): GmAssistant {
  const [question, setQuestion] = useState('')
  const { state, run } = useAi<GmAssistantValue>({ feature: 'gmAssistant', campaignId, input: { question: question.trim() } })
  // A suggested question fills the box and asks it: the run waits for the render that puts it in the request.
  const [asking, setAsking] = useState(0)
  useEffect(() => {
    if (asking > 0) run()
  }, [asking, run])

  const value = state.status === 'done' && state.outcome.kind === 'result' ? state.outcome.value : null
  // A note goes under a card only when exactly one card has its name; the answer names characters, not ids.
  const cardsByName = new Map<string, number>()
  for (const c of characters) cardsByName.set(key(c.name), (cardsByName.get(key(c.name)) ?? 0) + 1)
  const onOneCard = (name: string) => cardsByName.get(key(name)) === 1
  return {
    question,
    setQuestion,
    state,
    ask: (q) => {
      const next = (q ?? question).trim()
      if (!next) return
      if (q !== undefined) setQuestion(q)
      setAsking((n) => n + 1)
    },
    notesFor: (name) =>
      value && onOneCard(name) ? value.perCharacter.filter((p) => key(p.characterName) === key(name)).map((p) => p.note) : [],
    unmatched: value ? value.perCharacter.filter((p) => !onOneCard(p.characterName)) : [],
  }
}

export function GmAssistantPanel({ assistant }: { assistant: GmAssistant }) {
  const { question, setQuestion, ask, state } = assistant
  const id = useId()
  const loading = state.status === 'loading'
  const problem: AiProblem | null =
    state.status === 'unreachable' ? { kind: 'unreachable' } : state.status === 'done' && state.outcome.kind !== 'result' ? state.outcome : null
  const value = state.status === 'done' && state.outcome.kind === 'result' ? state.outcome.value : null
  const others = assistant.unmatched

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!loading) ask()
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h2 id={`${id}-title`} className="eyebrow">
        Ask the GM assistant
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor={id} className="sr-only">
          Your question
        </label>
        <Textarea
          id={id}
          value={question}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder="Ask about the characters in this campaign"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
          }}
          className="min-h-20"
        />
        <Button type="submit" size="lg" className="self-end" disabled={loading || !question.trim()}>
          Ask
        </Button>
      </form>
      <ul className="flex flex-col gap-1" aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((q) => (
          <li key={q}>
            <button
              type="button"
              disabled={loading}
              onClick={() => ask(q)}
              className="min-h-11 w-full rounded-md px-2 text-left text-ui text-primary hover:bg-surface-muted disabled:opacity-50"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
      {loading && <Thinking />}
      {problem && <AiFailureLine problem={problem} verb="answer" onRetry={() => ask()} />}
      {value && (
        <div className="flex flex-col gap-2 border-t border-border pt-3" aria-live="polite">
          <p className="text-ui whitespace-pre-line">{value.answer}</p>
          {others.map((p, i) => (
            <p key={i} className="text-ui whitespace-pre-line">
              <span className="font-semibold">{p.characterName}:</span> {p.note}
            </p>
          ))}
          {value.perCharacter.length > others.length && (
            <p className="text-meta text-muted-foreground">Notes on each character are under their card.</p>
          )}
          {value.rulesCited.length > 0 && (
            <p className="text-meta text-muted-foreground">Rules: {value.rulesCited.join('; ')}</p>
          )}
        </div>
      )}
    </section>
  )
}
