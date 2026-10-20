import { createFileRoute } from '@tanstack/react-router'
import { ChapterPage, chapterHead } from '~/components/article/chapter-page'
import { loadChapter } from '~/components/article/chapter-route'

export const Route = createFileRoute('/player/$chapter')({
  loader: ({ params }) => loadChapter('player', params.chapter),
  // Compiled content is immutable per deploy: hash changes and revisits reuse the loaded chapter.
  staleTime: Infinity,
  head: ({ loaderData }) => chapterHead(loaderData),
  component: PlayerChapter,
})

function PlayerChapter() {
  return <ChapterPage {...Route.useLoaderData()} />
}
