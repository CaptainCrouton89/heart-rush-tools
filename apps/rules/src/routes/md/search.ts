import { createFileRoute } from '@tanstack/react-router'
import { content } from '~/lib/content'
import { agentResponse, parseAgentQuery, renderError, renderSearch, searchAgent } from '@heartrush/content/runtime'

// GET /md/search?q=&scope=&limit= — token-prefix search over the compiler's search records.
export const Route = createFileRoute('/md/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const version = content.manifest.contentVersion
        const url = new URL(request.url)
        const parsed = parseAgentQuery(url.searchParams)
        if (!parsed.ok) {
          return agentResponse(renderError(version, 400, parsed.message, `Example: ${url.origin}/md/search?q=grappling&scope=player&limit=5`), 400, version)
        }
        try {
          const index = await content.getAgentIndex()
          if (!index) throw new Error('agent/index.json missing')
          return agentResponse(renderSearch(index, parsed.query, searchAgent(index, parsed.query), url.origin), 200, version)
        } catch (e) {
          console.error('md search unavailable', e)
          return agentResponse(renderError(version, 503, 'Rules lookup unavailable; retry later'), 503, version)
        }
      },
    },
  },
})
