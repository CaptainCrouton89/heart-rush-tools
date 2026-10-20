// The only wiring between the compiled rulebook and this Worker. Accessors live in @heartrush/content/runtime.
// Only manifest.json is bundled; page bodies, catalogues, previews and the Pagefind index are static assets
// served from /_content/<contentVersion>/ (see packages/content/src/build.ts).
import { env } from 'cloudflare:workers'
import manifest from '@heartrush/content/manifest'
import { createContent } from '@heartrush/content/runtime'
import type { Manifest } from '@heartrush/content/types'

export const content = createContent(manifest as Manifest, (url) => env.ASSETS.fetch(new URL(url, 'https://assets.invalid')))
