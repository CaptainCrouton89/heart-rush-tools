import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

/** Serves generated monster images from R2. Keys are random and never rewritten, so they cache forever. */
export const Route = createFileRoute('/images/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const object = await env.IMAGES.get(params.key)
        if (!object) return new Response('Not found', { status: 404 })
        return new Response(object.body, {
          headers: {
            'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
            'cache-control': 'public, max-age=31536000, immutable',
            etag: object.httpEtag,
          },
        })
      },
    },
  },
})
