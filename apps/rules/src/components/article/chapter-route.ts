// Loader shared by /player/$chapter and /gm/$chapter: the compiled chapter for the URL, its book's navigation, and
// its previous/next chapters by name. Anything that is not a chapter of that book is a genuine 404.
import { notFound } from '@tanstack/react-router'
import { getPageByPathFn, getReadingContextFn } from '~/server/content'
import type { ChapterData } from './chapter-page'

export async function loadChapter(book: 'player' | 'gm', chapter: string): Promise<ChapterData> {
  const page = await getPageByPathFn({ data: `/${book}/${chapter}` })
  if (!page || page.kind !== 'chapter' || page.scope !== book) throw notFound()
  const ids = [page.previous, page.next].filter((id): id is string => id !== null)
  const { nav, links } = await getReadingContextFn({ data: { book, ids } })
  const find = (id: string | null) => (id ? (links.find((l) => l.id === id) ?? null) : null)
  return { page, nav, previous: find(page.previous), next: find(page.next) }
}
