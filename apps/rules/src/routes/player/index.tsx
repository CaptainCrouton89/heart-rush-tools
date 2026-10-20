import { createFileRoute } from '@tanstack/react-router'
import { BookHome } from '~/components/landing/book-home'
import { pageTitle } from '~/components/landing/book-page'
import { getBookHomeFn } from '~/server/content'

export const Route = createFileRoute('/player/')({
  loader: () => getBookHomeFn({ data: 'player' }),
  head: ({ loaderData }) => pageTitle(loaderData?.nav.label),
  component: () => <BookHome {...Route.useLoaderData()} />,
})
