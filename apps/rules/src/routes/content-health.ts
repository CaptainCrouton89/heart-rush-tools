import { createFileRoute } from '@tanstack/react-router'
import { content } from '~/lib/content'

// Proves the Worker can resolve a route from the bundled manifest and fetch page JSON through the assets binding.
export const Route = createFileRoute('/content-health')({
  server: {
    handlers: {
      GET: async () => {
        const page = await content.getPageByPath('/player/combat')
        return Response.json({
          contentVersion: content.manifest.contentVersion,
          pages: content.manifest.pages.length,
          combat: page ? { title: page.title, headings: page.headings.length, version: page.contentVersion } : null,
        })
      },
    },
  },
})
