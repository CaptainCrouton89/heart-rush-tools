import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">Heart Rush Rules</h1>
      <p className="text-muted-foreground">The rulebook is moving here. Coming soon.</p>
      <Button>Placeholder</Button>
    </main>
  )
}
