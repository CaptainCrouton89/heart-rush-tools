// The creation assistant's chat beside the builder (design "Components": AssistantPanel; spec "Opening", "Each turn",
// "Running and failure"). It fills its container — a desktop column or the phone's Assistant tab — with its own scroll
// and the composer pinned at the bottom. On an empty chat: the greeting and the four ways to start, each sent as the
// player's message. Then the messages (the assistant's printed, the player's in their hand), each assistant turn's
// decision and proposal card, the running line with **Stop**, and the failure line.
//
// The route holds the state (`useAssistant`) so its tab bar can read the unread dots; this panel only shows it.
import { useEffect, useRef } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { ChatText } from '@heartrush/ui/components/chat/chat-text'
import { Composer } from '@heartrush/ui/components/chat/composer'
import { type AssistantMessage, type StoredMessage } from '~/assistant/schema'
import { AiFailureLine } from '~/components/ai/AiFailure'
import type { StepNumber } from '~/components/builder/draft-rules'
import type { UseDraft } from '~/components/builder/use-draft'
import { DecisionView } from './DecisionView'
import { ProposalCard, type Applied } from './ProposalCard'
import { useElapsed, type UseAssistant } from './use-assistant'

/** Shown above an empty chat; not stored. */
export const GREETING =
  "I can help you make your character, a few decisions at a time. Nothing changes until you tap Apply on a card I suggest. Tell me what you have in mind, or start with one of these."

/** The spec's four ways to start, sent as the player's message when tapped. */
export const STARTERS = [
  "I've got an idea for a character",
  'I know who they are; help me with the rules',
  'I want to dig into the build',
  'Not sure yet; give me some ideas',
] as const

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function AssistantPanel({
  assistant,
  draft,
  onOpenStep,
  onApplied,
}: {
  assistant: UseAssistant
  /** The builder's draft; null on `/characters/new` before the draft exists. */
  draft: UseDraft | null
  /**
   * Moves the builder to a step. `show` is true for See all and a card heading: on phone the route also switches to the
   * Builder tab.
   */
  onOpenStep: (step: StepNumber, show: boolean) => void
  /** After a card's Apply saved: the route moves the builder behind the chat and writes the values in. */
  onApplied: (applied: Applied) => void
}) {
  const { messages, running } = assistant
  const scroller = useRef<HTMLDivElement>(null)
  const lastAssistant = messages.map((m) => m.role).lastIndexOf('assistant')

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, running !== null])

  const send = (text: string) => void assistant.send(text)
  const empty = messages.length === 0 && !running
  // Nothing new goes out while a run is in flight or the last message is waiting for Retry.
  const busy = running !== null || assistant.unsent

  return (
    <section aria-label="Character assistant" className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
        <p className="rules-text">{GREETING}</p>
        {empty && assistant.loaded && (
          <ul className="mt-3 flex flex-col items-start gap-3.5" aria-label="Ways to start">
            {STARTERS.map((s) => (
              <li key={s}>
                <Button size="compact" variant="line" type="button" className="h-auto min-h-[30px] py-1 text-left whitespace-normal" onClick={() => send(s)}>
                  {s}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <ol className="mt-5 flex flex-col gap-5" aria-label="Conversation">
          {messages.map((m, i) => (
            <li key={m.id}>
              <Message
                message={m}
                draft={draft}
                latest={i === lastAssistant && i === messages.length - 1}
                busy={busy}
                onSend={send}
                onOpenStep={onOpenStep}
                onApplied={onApplied}
              />
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
        <RunLine assistant={assistant} />
        <Composer label="Message to the assistant" placeholder={empty ? 'Describe who you want to play…' : 'Reply, or ask for a change…'} disabled={busy} onSend={(text) => assistant.send(text)} />
      </div>
    </section>
  )
}

function Message({
  message,
  draft,
  latest,
  busy,
  onSend,
  onOpenStep,
  onApplied,
}: {
  message: StoredMessage
  draft: UseDraft | null
  latest: boolean
  busy: boolean
  onSend: (text: string) => void
  onOpenStep: (step: StepNumber, show: boolean) => void
  onApplied: (applied: Applied) => void
}) {
  if (message.role === 'player') {
    return (
      <div className="ml-8 flex justify-end">
        <p className="font-hand text-[17px] leading-6 whitespace-pre-wrap text-foreground">{message.text}</p>
      </div>
    )
  }
  return <AssistantTurn message={message} draft={draft} latest={latest} busy={busy} onSend={onSend} onOpenStep={onOpenStep} onApplied={onApplied} />
}

function AssistantTurn({
  message,
  draft,
  latest,
  busy,
  onSend,
  onOpenStep,
  onApplied,
}: {
  message: AssistantMessage
  draft: UseDraft | null
  latest: boolean
  busy: boolean
  onSend: (text: string) => void
  onOpenStep: (step: StepNumber, show: boolean) => void
  onApplied: (applied: Applied) => void
}) {
  return (
    <div>
      <ChatText text={message.text} className="rules-text [&_a]:text-primary" />
      {message.card && <ProposalCard card={message.card} draft={draft} onOpenStep={onOpenStep} onApplied={onApplied} />}
      {/* Only the newest turn's options send: an older question has already been answered. */}
      {message.decision && <DecisionView decision={message.decision} onSend={onSend} onOpenStep={onOpenStep} disabled={busy || !latest} />}
    </div>
  )
}

/** Below the conversation: the running line with Stop, a stop that was not confirmed, or why the last run gave nothing. */
function RunLine({ assistant }: { assistant: UseAssistant }) {
  const elapsed = useElapsed(assistant.running?.since ?? null)
  if (assistant.running) {
    return (
      <div role="status" className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-ui text-foreground">
          {assistant.stopping ? 'Stopping…' : assistant.stopUnconfirmed ? "Couldn't stop yet." : 'Thinking…'}{' '}
          <span className="text-muted-foreground tabular-nums">{clock(elapsed)}</span>
        </p>
        <Button size="compact" variant="line" type="button" disabled={assistant.stopping} onClick={() => void assistant.stop()}>
          Stop
        </Button>
      </div>
    )
  }
  const retry = () => void assistant.retry()
  const problem = assistant.sendProblem
  if (problem?.kind === 'unreachable') return <AiFailureLine problem={{ kind: 'unreachable' }} verb="send" onRetry={retry} />
  if (problem?.kind === 'unsaved') {
    return (
      <p role="alert" className="text-ui text-muted-foreground">
        Couldn't send: the builder's latest changes are not saved. Retry the save above, then send again.
      </p>
    )
  }
  if (problem?.kind === 'bad_input') {
    return (
      <p role="alert" className="text-ui text-muted-foreground">
        Couldn't send: {problem.message.replace(/\.$/, '')}.
      </p>
    )
  }
  const error = assistant.error
  if (!error) return null
  if (error.reason === 'stopped') {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 text-ui text-muted-foreground">Stopped. Nothing in the draft changed.</p>
        <Button size="compact" variant="line" type="button" onClick={retry}>
          Retry
        </Button>
      </div>
    )
  }
  return <AiFailureLine problem={{ kind: 'failed', reason: error.reason }} verb="answer" deadline="15 minutes" onRetry={retry} />
}
