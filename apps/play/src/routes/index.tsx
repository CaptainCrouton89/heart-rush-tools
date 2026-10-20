import { createFileRoute, redirect } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.session) throw redirect({ to: '/characters' })
  },
  component: Landing,
})

function Landing() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-6 px-5 pt-16 md:pt-24">
      <h1 className="font-serif text-h1-sm font-semibold md:text-h1">Heart Rush Play</h1>
      <p className="font-serif text-body-sm md:text-body">
        Keep your Heart Rush characters here: build one step by step, track HP, wounds and rush points at the table, spend XP as you
        advance, and share sheets with your campaign&rsquo;s GM.
      </p>
      <Button asChild size="lg">
        <a href={`/auth/login?returnTo=${encodeURIComponent('/characters')}`}>Sign in with Northlight</a>
      </Button>
    </div>
  )
}
