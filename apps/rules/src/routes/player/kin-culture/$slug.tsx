import { createFileRoute, notFound } from '@tanstack/react-router'
import { CATALOGUES } from '~/components/catalogue/config'
import { EntryPage } from '~/components/catalogue/entry-page'
import { getCatalogueEntryFn } from '~/server/content'

const config = CATALOGUES['kin-culture']

export const Route = createFileRoute('/player/kin-culture/$slug')({
  loader: async ({ params }) => {
    const data = await getCatalogueEntryFn({ data: { path: `${config.path}/${params.slug}`, kind: config.entryKind } })
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `${loaderData.page.title} — ${config.title} — Heart Rush Rules` }, ...(loaderData.page.description ? [{ name: 'description', content: loaderData.page.description }] : [])]
      : [],
  }),
  component: Entry,
})

function Entry() {
  const { page, nav } = Route.useLoaderData()
  return <EntryPage config={config} page={page} nav={nav} />
}
