import { createFileRoute, notFound } from '@tanstack/react-router'
import { BookPage, pageTitle } from '~/components/landing/book-page'
import { getBookPageFn } from '~/server/content'

// The Alaria home: overview body, World map ↗ beside the title, then each category with its topics.
export const Route = createFileRoute('/worlds/alaria/')({
  loader: async ({ location }) => {
    const data = await getBookPageFn({ data: location.pathname })
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => pageTitle(loaderData?.page.title),
  component: () => <BookPage data={Route.useLoaderData()} />,
})
