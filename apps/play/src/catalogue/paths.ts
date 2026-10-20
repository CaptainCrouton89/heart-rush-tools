// Ruling 12: there is no compiled path catalogue. These are the five paths under "Available Paths" in
// Paths.md, each with the rulebook path of its heading (the rules site's `/player/paths#<heading id>`).
// The engine stores `pathId` as given; ids are these slugs.

export type PlayPath = { id: string; title: string; path: string }

export const PATHS: readonly PlayPath[] = [
  { id: 'vampire', title: 'Vampire', path: '/player/paths#vampire' },
  { id: 'lycanthrope', title: 'Lycanthrope', path: '/player/paths#lycanthrope' },
  { id: 'syncopath', title: 'Syncopath', path: '/player/paths#syncopath' },
  { id: 'physiarch', title: 'Physiarch', path: '/player/paths#physiarch' },
  { id: 'beastheart', title: 'Beastheart', path: '/player/paths#beastheart' },
]

export const PATHS_BY_ID: ReadonlyMap<string, PlayPath> = new Map(PATHS.map((p) => [p.id, p]))
