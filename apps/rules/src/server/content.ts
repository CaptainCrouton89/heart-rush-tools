// Server functions over the compiled rulebook. Route loaders call these (never `~/lib/content` directly):
// `content` imports `cloudflare:workers`, which only exists in the Worker, while loaders also run in the browser.
import { createServerFn } from '@tanstack/react-start'
import type { CatalogueKind } from '@heartrush/content/types'
import { content } from '~/lib/content'

/** One page (chapter, landing, catalogue entry, world article) by canonical pathname, or null → the route throws notFound(). */
export const getPageByPathFn = createServerFn({ method: 'GET' })
  .validator((pathname: string) => pathname)
  .handler(({ data }) => content.getPageByPath(data))

export const getPageFn = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(({ data }) => content.getPage(data))

export const getCatalogueFn = createServerFn({ method: 'GET' })
  .validator((kind: CatalogueKind) => kind)
  .handler(({ data }) => content.getCatalogue(data))
