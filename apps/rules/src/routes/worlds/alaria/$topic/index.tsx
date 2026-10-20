import { createFileRoute, notFound } from '@tanstack/react-router'
import { BookPage, pageTitle } from '~/components/landing/book-page'
import { getBookPageFn } from '~/server/content'

// An Alaria topic landing, e.g. /worlds/alaria/ve. The sidebar shows topics; deeper pages use the splat route.
export const Route = createFileRoute('/worlds/alaria/$topic/')({
  loader: async ({ location }) => {
    const data = await getBookPageFn({ data: location.pathname })
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => pageTitle(loaderData?.page.title),
  component: () => <BookPage data={Route.useLoaderData()} />,
})
