import { createFileRoute, notFound } from '@tanstack/react-router'
import { BookPage, pageTitle } from '~/components/landing/book-page'
import { getBookPageFn } from '~/server/content'

// Anything below an Alaria topic: nested region indexes and source articles, any number of segments deep.
export const Route = createFileRoute('/worlds/alaria/$topic/$')({
  loader: async ({ location }) => {
    const data = await getBookPageFn({ data: location.pathname })
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => pageTitle(loaderData?.page.title),
  component: () => <BookPage data={Route.useLoaderData()} />,
})
