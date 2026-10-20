import { createFileRoute } from '@tanstack/react-router'
import { ChapterPage, chapterHead } from '~/components/article/chapter-page'
import { loadChapter } from '~/components/article/chapter-route'

export const Route = createFileRoute('/gm/$chapter')({
  loader: ({ params }) => loadChapter('gm', params.chapter),
  // Compiled content is immutable per deploy: hash changes and revisits reuse the loaded chapter.
  staleTime: Infinity,
  head: ({ loaderData }) => chapterHead(loaderData),
  component: GmChapter,
})

function GmChapter() {
  return <ChapterPage {...Route.useLoaderData()} />
}
