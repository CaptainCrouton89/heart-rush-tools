import { createFileRoute, notFound } from '@tanstack/react-router'
import { BookPage, pageTitle } from '~/components/landing/book-page'
import { getBookPageFn } from '~/server/content'

// A GM category landing, e.g. /gm/topics/encounters.
export const Route = createFileRoute('/gm/topics/$group')({
  loader: async ({ location }) => {
    const data = await getBookPageFn({ data: location.pathname })
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => pageTitle(loaderData?.page.title),
  component: () => <BookPage data={Route.useLoaderData()} />,
})
