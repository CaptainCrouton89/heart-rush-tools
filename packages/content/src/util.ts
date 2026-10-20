import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const REPO = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '')

export function kebab(s: string): string {
  return s
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export function readText(rel: string): string {
  return readFileSync(join(REPO, rel), 'utf8').replace(/\r\n/g, '\n')
}

export function listMd(rel: string): string[] {
  return readdirSync(join(REPO, rel)).filter((f) => f.endsWith('.md') && !f.startsWith('.') && f !== 'CLAUDE.md').sort((a, b) => a.localeCompare(b))
}

export function listDirs(rel: string): string[] {
  return readdirSync(join(REPO, rel)).filter((f) => statSync(join(REPO, rel, f)).isDirectory()).sort()
}

export function stem(file: string): string { return file.replace(/\.md$/, '') }

export function firstSentence(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const m = /^(.+?[.!?])(?:\s+(?=["“A-Z0-9])|$)/.exec(clean)
  const s = m ? m[1] : clean
  return s.length > max ? s.slice(0, max).replace(/\s+\S*$/, '') + '…' : s
}

export function excerptWords(text: string, max = 120): { text: string; truncated: boolean } {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length <= max) return { text: words.join(' '), truncated: false }
  return { text: words.slice(0, max).join(' ') + '…', truncated: true }
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
