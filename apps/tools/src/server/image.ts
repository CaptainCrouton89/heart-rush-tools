import { env } from 'cloudflare:workers'

declare global {
  namespace Cloudflare {
    interface Env {
      /** Worker secret: the image provider's API key (currently fal.ai). Unset means every image fails as unavailable. */
      IMAGE_API_KEY: string
    }
  }
}

export type GeneratedImage = { bytes: ArrayBuffer; contentType: string }

/**
 * Prompt in, image bytes out. The app's only image-provider code: the model is the `IMAGE_MODEL` var
 * (a fal.ai model id, e.g. `fal-ai/flux-pro/v1.1`) and the key is the `IMAGE_API_KEY` secret.
 */
export async function generateImage(prompt: string, signal?: AbortSignal): Promise<GeneratedImage> {
  if (!env.IMAGE_API_KEY) throw new Error('IMAGE_API_KEY is not set')
  signal = AbortSignal.any([AbortSignal.timeout(120_000), ...(signal ? [signal] : [])])
  const response = await fetch(`https://fal.run/${env.IMAGE_MODEL}`, {
    method: 'POST',
    signal,
    headers: { authorization: `Key ${env.IMAGE_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: 'portrait_4_3', num_images: 1, output_format: 'jpeg' }),
  })
  if (!response.ok) throw new Error(`${env.IMAGE_MODEL} returned ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const body = (await response.json()) as { images?: { url: string; content_type?: string }[]; has_nsfw_concepts?: boolean[] }
  const image = body.images?.[0]
  if (!image) throw new Error(`${env.IMAGE_MODEL} returned no image`)
  const file = await fetch(image.url, { signal })
  if (!file.ok) throw new Error(`Downloading the generated image failed: ${file.status}`)
  const contentType = file.headers.get('content-type')?.split(';')[0].trim()
  if (!contentType || !EXTENSION[contentType]) throw new Error(`Unsupported image content type: ${contentType}`)
  const bytes = await file.arrayBuffer()
  if (!bytes.byteLength) throw new Error('The image provider returned an empty file')
  return { bytes, contentType }
}

const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Store an image in the `IMAGES` R2 bucket and return the path it is served from (`/images/<key>`). */
export async function storeImage(image: GeneratedImage): Promise<string> {
  const extension = EXTENSION[image.contentType]
  if (!extension) throw new Error(`Unsupported image content type: ${image.contentType}`)
  const key = `${crypto.randomUUID()}.${extension}`
  await env.IMAGES.put(key, image.bytes, { httpMetadata: { contentType: image.contentType } })
  return `/images/${key}`
}
