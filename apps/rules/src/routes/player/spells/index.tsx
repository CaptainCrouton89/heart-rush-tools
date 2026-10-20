import { createFileRoute } from '@tanstack/react-router'
import { CataloguePage } from '~/components/catalogue/catalogue-page'
import { CATALOGUES } from '~/components/catalogue/config'
import { validateCatalogueSearch } from '~/components/catalogue/query'
import { getCatalogueViewFn } from '~/server/content'

const config = CATALOGUES['spells']

export const Route = createFileRoute('/player/spells/')({
  validateSearch: validateCatalogueSearch(config),
  // Content is versioned per deploy; filter and page changes must not refetch the catalogue.
  staleTime: Infinity,
  loader: () => getCatalogueViewFn({ data: config.kind }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.page.title} — Heart Rush Rules` }, { name: 'description', content: config.lede }] : [],
  }),
  component: Catalogue,
})

function Catalogue() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  return <CataloguePage config={config} {...data} search={search} />
}
