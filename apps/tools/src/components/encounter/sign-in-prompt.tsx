import { Alert, AlertDescription, AlertTitle } from '@heartrush/ui/components/alert'

/** The monster generator's sign-in prompt, worded for the encounter builder. */
export function SignInPrompt({ returnTo, renew }: { returnTo: string; renew?: boolean }) {
  return (
    <Alert>
      <AlertTitle>{renew ? 'Sign in again to continue' : 'Sign in to build encounters'}</AlertTitle>
      <AlertDescription>
        {renew
          ? 'Your Northlight connection needs to be renewed. '
          : 'The encounter builder runs on your own Northlight account and AI subscription, not on a shared key, and saves your encounters and party there. '}
        <a className="text-primary underline underline-offset-2" href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>
          Sign in with Northlight
        </a>
        .
      </AlertDescription>
    </Alert>
  )
}
