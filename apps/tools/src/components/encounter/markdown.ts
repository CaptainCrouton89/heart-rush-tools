import type { Encounter } from '~/encounter/schema'
import { generateMarkdown } from '~/monster/markdown'

const list = (items: string[]) => items.map((item) => `- ${item}`).join('\n')

/** The whole encounter document as Markdown, in the order the page shows it. Each stat block is the monster generator's Markdown. */
export function encounterMarkdown(e: Encounter): string {
  const parts: string[] = [`# ${e.title}`, e.summary, '## Enemies']
  for (const enemy of e.enemies) {
    parts.push(`**${enemy.count} × ${enemy.statBlock.name}** (${enemy.role})`, generateMarkdown(enemy.statBlock).trim())
  }
  if (e.terrain.length) parts.push('## Terrain', list(e.terrain.map((t) => `**${t.name}**: ${t.rules}`)))
  if (e.tactics.length) parts.push('## Tactics', list(e.tactics))
  if (e.hooks.length) parts.push('## Hooks', list(e.hooks))
  if (e.scaling.easier.length || e.scaling.harder.length) {
    parts.push('## Scaling')
    if (e.scaling.easier.length) parts.push('**If it runs too hard**', list(e.scaling.easier))
    if (e.scaling.harder.length) parts.push('**If it runs too easy**', list(e.scaling.harder))
  }
  return parts.join('\n\n') + '\n'
}
