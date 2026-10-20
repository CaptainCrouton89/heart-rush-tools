import { createFileRoute } from '@tanstack/react-router'
import { content } from '~/lib/content'
import { agentResponse, renderError, renderIndex } from '@heartrush/content/runtime'

// GET /md — entry point for agents: how to search and read, and the player/GM chapter list.
export const Route = createFileRoute('/md/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const version = content.manifest.contentVersion
        const origin = new URL(request.url).origin
        try {
          const index = await content.getAgentIndex()
          if (!index) throw new Error('agent/index.json missing')
          return agentResponse(renderIndex(index, origin), 200, version)
        } catch (e) {
          console.error('md index unavailable', e)
          return agentResponse(renderError(version, 503, 'Rules lookup unavailable; retry later'), 503, version)
        }
      },
    },
  },
})
