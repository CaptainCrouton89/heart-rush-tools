import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@heartrush/ui/components/card'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">Heart Rush Tools</h1>
        <p className="text-muted-foreground">Tools for running and playing Heart Rush.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/monster-generator" className="block">
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardTitle>Monster Generator</CardTitle>
                <CardDescription>
                  Describe a creature and get a Heart Rush stat block. Runs on your own Northlight account, so it
                  needs sign-in.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Elsewhere in Heart Rush</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <a href="https://rules.heartrush.party" className="block">
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardTitle>Rules</CardTitle>
                <CardDescription>The rulebook, GM guide and Alaria wiki.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">rules.heartrush.party</CardContent>
            </Card>
          </a>
          <a href="https://play.heartrush.party" className="block">
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardTitle>Play</CardTitle>
                <CardDescription>Character sheets and parties.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">play.heartrush.party</CardContent>
            </Card>
          </a>
        </div>
      </section>
    </main>
  )
}
