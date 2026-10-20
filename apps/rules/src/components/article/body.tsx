// Placeholder until the article unit lands. Contract: renders a compiled body tree (paragraphs, headings with ids,
// lists, tables, callouts, dice, links). Internal links with a `target` render through ReferenceLink (preview unit).
import type { Block } from '@heartrush/content/types'

export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return <div className="prose-rules">{blocks.length} blocks</div>
}
