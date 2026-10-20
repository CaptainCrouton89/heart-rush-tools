import { createFileRoute } from '@tanstack/react-router'
import { content } from '~/lib/content'
import { agentResponse, findAgentPage, renderError, renderOutlineRows, renderUnit } from '@heartrush/content/runtime'

// GET /md/<page path>?section=<anchor> — a page or one section as its source Markdown (an outline when over the size limit).
export const Route = createFileRoute('/md/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const version = content.manifest.contentVersion
        const url = new URL(request.url)
        const origin = url.origin
        const path = '/' + (params._splat ?? '').replace(/\/$/, '')
        const err = (status: number, message: string, more = '') => agentResponse(renderError(version, status, message, more), status, version)
        const pageId = content.manifest.routes[path]
        if (!pageId) return err(404, `No rules page at ${path}`, `Rulebook index: ${origin}/md`)
        try {
          const index = await content.getAgentIndex()
          if (!index) throw new Error('agent/index.json missing')
          const page = findAgentPage(index, path)
          if (!page) return err(404, `${path} is not served as Markdown; only player rules and GM guide pages are`, `Rulebook index: ${origin}/md`)
          const section = url.searchParams.get('section')
          const body = await renderUnit(index, page, section, origin, async (part) => {
            const text = await content.getAgentSource(page.id, part)
            if (text === null) throw new Error(`source part ${page.id}.${part} missing`)
            return text
          })
          if (body === null) return err(404, `No section ${section} on ${path}`, `Top-level sections of this page:\n\n${renderOutlineRows(page, null, origin)}`)
          return agentResponse(body, 200, version)
        } catch (e) {
          console.error('md page unavailable', e)
          return err(503, 'Rules lookup unavailable; retry later')
        }
      },
    },
  },
})
