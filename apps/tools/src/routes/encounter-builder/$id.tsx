import { useEffect, useRef, useState } from 'react'
import { createFileRoute, getRouteApi, Link } from '@tanstack/react-router'
import { Alert, AlertDescription } from '@heartrush/ui/components/alert'
import { Button } from '@heartrush/ui/components/button'
import { cn } from '@heartrush/ui/lib/utils'
import type { StoredMessage } from '~/encounter/schema'
import { ChatText } from '~/components/encounter/chat-text'
import { Composer } from '~/components/encounter/composer'
import { DocumentActions, EncounterDocument } from '~/components/encounter/encounter-document'
import { SignInPrompt } from '~/components/encounter/sign-in-prompt'
import { Chip, OutlineView, QuestionsStep, QuickReplies } from '~/components/encounter/steps'
import { useElapsed, useEncounter } from '~/components/encounter/use-encounter'

const rootRoute = getRouteApi('__root__')

export const Route = createFileRoute('/encounter-builder/$id')({
  head: () => ({ meta: [{ title: 'Encounter builder · Heart Rush Tools' }] }),
  component: EncounterPage,
})

type Tab = 'chat' | 'encounter'

function EncounterPage() {
  const { id } = Route.useParams()
  const signedIn = rootRoute.useLoaderData() !== null
  const returnTo = `/encounter-builder/${id}`
  if (!signedIn) {
    return (
      <div className="mx-auto max-w-[720px] px-5 pt-10 md:px-8">
        <SignInPrompt returnTo={returnTo} />
      </div>
    )
  }
  return <SplitView key={id} id={id} />
}

function SplitView({ id }: { id: string }) {
  const enc = useEncounter(id)
  const [tab, setTab] = useState<Tab>('chat')
  const [seenVersion, setSeenVersion] = useState(0)
  const { detail, status } = enc

  // Opening the Encounter tab (or seeing the document beside the chat) clears the update dot.
  useEffect(() => {
    if (tab === 'encounter') setSeenVersion(enc.documentVersion)
  }, [tab, enc.documentVersion])
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)')
    if (wide.matches) setSeenVersion(enc.documentVersion)
  }, [enc.documentVersion])
  const unseen = enc.documentVersion > seenVersion

  useEffect(() => {
    if (detail?.title && detail.title !== 'New encounter') document.title = `${detail.title} · Encounter builder`
  }, [detail?.title])

  if (status.kind === 'loading') return <Centered>Loading the encounter…</Centered>
  if (status.kind === 'signedOut') return <Centered><SignInPrompt returnTo={`/encounter-builder/${id}`} renew /></Centered>
  if (status.kind === 'missing')
    return (
      <Centered>
        <p>This encounter does not exist, or it belongs to another account.</p>
        <Link to="/encounter-builder" className="mt-3 inline-block text-primary underline underline-offset-2">
          Back to your encounters
        </Link>
      </Centered>
    )
  if (status.kind === 'failed' || !detail) return <Centered>{status.kind === 'failed' ? status.message : 'Could not load the encounter.'}</Centered>

  const title = detail.document?.title ?? (detail.title === 'New encounter' ? 'New encounter' : detail.title)

  return (
    <div className="mx-auto -mb-16 flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[1440px] flex-col md:min-h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-4rem)] print:mb-0 print:block print:h-auto print:min-h-0">
      {/* Title row and, below 1024px, the Chat / Encounter tabs. */}
      <div className="print-hidden sticky top-14 z-30 border-b border-border bg-background md:top-16 lg:static">
        <div className="flex items-center gap-3 px-5 py-3 max-[359px]:px-4 md:px-8">
          <Link
            to="/encounter-builder"
            className="shrink-0 rounded-sm text-ui text-muted-foreground hover:text-foreground"
            aria-label="All encounters"
          >
            ← <span className="max-sm:sr-only">Encounters</span>
          </Link>
          <h1 className="min-w-0 truncate font-serif text-h4 font-semibold">{title}</h1>
        </div>
        <div role="tablist" aria-label="View" className="flex px-5 max-[359px]:px-4 md:px-8 lg:hidden">
          {(['chat', 'encounter'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              onClick={() => setTab(t)}
              className={cn(
                'relative -mb-px flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 text-control font-medium transition-colors sm:flex-none sm:px-6',
                tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'chat' ? 'Chat' : 'Encounter'}
              {t === 'encounter' && unseen && tab !== 'encounter' && (
                <span className="size-2 rounded-full bg-primary" aria-label="(updated)" role="img" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] print:block">
        <section
          id="panel-chat"
          role="tabpanel"
          aria-labelledby="tab-chat"
          aria-label="Chat"
          className={cn(
            'print-hidden min-h-0 flex-1 flex-col lg:flex lg:border-r lg:border-border',
            tab === 'chat' ? 'flex' : 'hidden',
          )}
        >
          <ChatPanel enc={enc} onShowEncounter={() => setTab('encounter')} />
        </section>
        <section
          id="panel-encounter"
          role="tabpanel"
          aria-labelledby="tab-encounter"
          aria-label="Encounter"
          className={cn('min-h-0 lg:block lg:overflow-y-auto print:block print:overflow-visible', tab === 'encounter' ? 'block' : 'hidden')}
        >
          <DocumentPanel enc={enc} />
        </section>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[720px] px-5 pt-16 text-center font-serif text-body-sm text-muted-foreground">{children}</div>
}

type Enc = ReturnType<typeof useEncounter>

function DocumentPanel({ enc }: { enc: Enc }) {
  const doc = enc.detail?.document
  if (!doc) {
    return (
      <div className="print-hidden flex min-h-60 items-center justify-center px-6 py-16 text-center lg:h-full">
        <p className="max-w-sm font-serif text-body-sm text-muted-foreground">
          {enc.running
            ? 'The encounter appears here once the stat blocks are written.'
            : 'No encounter yet. Describe the fight in the chat; the stat blocks appear here.'}
        </p>
      </div>
    )
  }
  return (
    <div className="px-5 pt-5 pb-16 max-[359px]:px-4 md:px-8 lg:pt-6 print:p-0">
      <div className="print-hidden mb-5 flex items-center justify-between gap-3">
        <p className="eyebrow">Current encounter</p>
        <DocumentActions encounter={doc} />
      </div>
      <EncounterDocument encounter={doc} />
    </div>
  )
}

function ChatPanel({ enc, onShowEncounter }: { enc: Enc; onShowEncounter: () => void }) {
  const messages = enc.messages
  const end = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const elapsed = useElapsed(enc.runSince)
  const last = messages.at(-1)
  const lastAgentIndex = messages.map((m) => m.role).lastIndexOf('agent')
  const unanswered = !enc.running && last?.role === 'gm' ? last.text : null

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)').matches
    if (wide && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
    else end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, enc.running])

  const lastAgent = lastAgentIndex >= 0 ? (messages[lastAgentIndex] as Extract<StoredMessage, { role: 'agent' }>) : null
  const writing = enc.detail?.document != null || lastAgent?.step.kind === 'outline'
  const stage = writing ? 'Writing stat blocks…' : 'Thinking…'
  const send = (text: string) => void enc.send(text)

  return (
    <>
      <div ref={scroller} className="min-h-0 flex-1 px-5 py-5 max-[359px]:px-4 md:px-8 lg:overflow-y-auto">
        <ol className="space-y-6" aria-label="Conversation">
          {messages.map((m, i) => (
            <li key={`${i}-${m.at}`}>
              {m.role === 'gm' ? (
                <GmMessage text={m.text} />
              ) : (
                <AgentMessage
                  message={m}
                  latest={i === lastAgentIndex && i === messages.length - 1 && !enc.running}
                  onSend={send}
                  onShowEncounter={onShowEncounter}
                />
              )}
            </li>
          ))}
        </ol>
        {messages.length === 0 && !enc.running && (
          <p className="font-serif text-body-sm text-muted-foreground">Describe the fight to start.</p>
        )}
        <div ref={end} />
      </div>

      <div className="sticky bottom-0 z-20 space-y-3 border-t border-border bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-[359px]:px-4 md:px-8 lg:static">
        {enc.running && (
          <div role="status" className="flex items-center gap-3">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-ui text-foreground">
              {enc.stopping ? 'Stopping…' : stage}{' '}
              <span className="text-muted-foreground tabular-nums">
                {elapsed}s{writing && !enc.stopping && elapsed < 60 ? ' · usually under a minute' : ''}
              </span>
            </p>
            <Button variant="outline" size="sm" onClick={() => void enc.stop()} disabled={enc.stopping}>
              {enc.stopping ? 'Stopping…' : 'Stop'}
            </Button>
          </div>
        )}
        {!enc.running && enc.stopped && (
          <p role="status" className="text-ui text-muted-foreground">
            Stopped. Your message is kept; send it again or write something else.
          </p>
        )}
        {enc.runError &&
          (enc.runError.signIn ? (
            <SignInPrompt returnTo={`/encounter-builder/${enc.detail?.id ?? ''}`} renew />
          ) : (
            <Alert variant="destructive">
              <AlertDescription>{enc.runError.message}</AlertDescription>
            </Alert>
          ))}
        {unanswered && (
          <div className="flex flex-wrap items-center gap-2">
            <Chip onClick={() => send(unanswered)}>Send again</Chip>
          </div>
        )}
        <Composer
          label="Message"
          placeholder={messages.length === 0 ? 'Describe the fight…' : 'Reply, or ask for a change…'}
          onSend={send}
          disabled={enc.running}
        />
      </div>
    </>
  )
}

function GmMessage({ text }: { text: string }) {
  return (
    <div className="ml-6 sm:ml-10">
      <p className="eyebrow mb-1 text-right">You</p>
      <ChatText text={text} className="rounded-md bg-surface-muted px-4 py-3 font-sans text-ui text-foreground" />
    </div>
  )
}

function AgentMessage({
  message,
  latest,
  onSend,
  onShowEncounter,
}: {
  message: Extract<StoredMessage, { role: 'agent' }>
  latest: boolean
  onSend: (text: string) => void
  onShowEncounter: () => void
}) {
  const { step } = message
  return (
    <div className="space-y-3">
      <p className="eyebrow">Builder</p>
      <ChatText text={message.text} className="font-serif text-body-sm text-foreground" />
      {step.kind === 'questions' && <QuestionsStep questions={step.questions} active={latest} onSend={onSend} />}
      {step.kind === 'outline' && (
        <>
          <OutlineView outline={step.outline} />
          {latest && <QuickReplies replies={step.suggestions} onSend={onSend} label="Reply to the outline" primaryFirst />}
        </>
      )}
      {step.kind === 'encounter' && (
        <>
          <button
            type="button"
            onClick={onShowEncounter}
            className="rounded-sm text-ui font-medium text-primary underline underline-offset-4 lg:hidden"
          >
            View the encounter →
          </button>
          {latest && <QuickReplies replies={step.suggestions} onSend={onSend} label="Suggested changes" />}
        </>
      )}
    </div>
  )
}
