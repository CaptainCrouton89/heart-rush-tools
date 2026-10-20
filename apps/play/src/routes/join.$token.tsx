// Invite acceptance (design "Invites", Key flow 8). Signed out → sign in and come back here; a live invite adds the user as a
// player and goes to the campaign; a member who opens the link again goes straight to the campaign without using the invite.
import { createFileRoute, redirect } from '@tanstack/react-router'
import { acceptInviteFn } from '~/server/campaigns'

export const Route = createFileRoute('/join/$token')({
  loader: async ({ params, context }): Promise<{ message: string }> => {
    if (!context.session) throw redirect({ href: `/auth/login?returnTo=${encodeURIComponent(`/join/${params.token}`)}` })
    const result = await acceptInviteFn({ data: { token: params.token } })
    if (result.ok) throw redirect({ href: `/campaigns/${result.campaignId}` })
    return { message: result.message }
  },
  head: () => ({ meta: [{ title: 'Join a campaign · Heart Rush Play' }] }),
  component: InviteRefused,
})

function InviteRefused() {
  const { message } = Route.useLoaderData()
  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-16">
      <h1 className="font-serif text-h2-sm font-semibold">Invite not accepted</h1>
      <p className="mt-2 text-body-sm text-muted-foreground">{message}</p>
      <a href="/characters" className="mt-4 inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
        Back to your characters
      </a>
    </div>
  )
}
