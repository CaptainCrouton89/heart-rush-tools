// The compiled content version, so the browser can address /_content/<contentVersion>/search/pagefind.js without
// the 732 KB manifest ever reaching client code. The handler runs on the server only.
import { createServerFn } from '@tanstack/react-start'
import { content } from '~/lib/content'

export const getContentVersionFn = createServerFn({ method: 'GET' }).handler(() => content.manifest.contentVersion)
