// Parsers for race and talent source files (metadata line, vitals, aspects, abilities).
import type { RaceFacets, TalentFacets } from './types.ts'

export const ELEMENTS = ['Air', 'Dark', 'Earth', 'Fire', 'Force', 'Ice', 'Light', 'Time', 'Void', 'Water']
const CADENCE = ['Passive', 'Minor', 'Major', 'Weekly', 'Monthly', 'Daily']
const TIMING = ['Instant', 'Full action']

// Source typos in the metadata line that are unambiguous. Keyed by source file; reported as info diagnostics.
export const META_REPAIRS: Record<string, [string, string]> = {
  'heart_rush/talents/spells/steam-fissure.md': ['_FMajor ability. ire and Water. Ongoing._', '_Major ability. Fire and Water. Ongoing._'],
}

export type ParsedMeta = { raw: string; facets: Omit<TalentFacets, 'collection' | 'hasDestinyUpgrade'>; unknown: string[] }

export function parseTalentMeta(rawLine: string): ParsedMeta {
  const raw = rawLine.trim()
  const inner = raw.replace(/^_+|_+$/g, '').trim()
  const segs = inner.split(/\.\s+|\.$/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean)
  const abilityTypes: string[] = []; const traditions: string[] = []; const elements: string[] = []; const timing: string[] = []
  const unknown: string[] = []
  let ongoing: boolean | null = null
  for (const seg of segs) {
    const cad = /^(\w+) ability$/i.exec(seg)
    if (cad && CADENCE.some((c) => c.toLowerCase() === cad[1].toLowerCase())) { abilityTypes.push(cad[1][0].toUpperCase() + cad[1].slice(1).toLowerCase()); continue }
    if (/^ongoing$/i.test(seg)) { ongoing = true; continue }
    const tim = TIMING.find((t) => t.toLowerCase() === seg.toLowerCase())
    if (tim) { timing.push(tim); continue }
    const trad = /^(martial|cognitive) talent$/i.exec(seg)
    if (trad) { traditions.push(trad[1][0].toUpperCase() + trad[1].slice(1).toLowerCase()); continue }
    if (/^handmagic$/i.test(seg)) { traditions.push('Handmagic'); continue }
    if (/^gaeic melody$/i.test(seg)) { traditions.push('Gaeic melody'); continue }
    const att = /^elemental attunement:\s*(.+)$/i.exec(seg)
    const names = (att ? att[1] : seg).split(/,\s*(?:and\s+)?|\s+(?:and|&)\s+/).map((s) => s.trim()).filter(Boolean)
    if (names.length && names.every((n) => ELEMENTS.some((e) => e.toLowerCase() === n.toLowerCase()))) {
      for (const n of names) { const e = ELEMENTS.find((x) => x.toLowerCase() === n.toLowerCase())!; if (!elements.includes(e)) elements.push(e) }
      continue
    }
    unknown.push(seg)
  }
  // The source only writes the "Ongoing" tag when it applies, so an otherwise-parsed line without it means not ongoing.
  if (ongoing === null && abilityTypes.length) ongoing = false
  return { raw, facets: { abilityTypes, traditions, elements, timing, ongoing }, unknown }
}

export function parseSize(vitalsList: string[]): RaceFacets['size'] {
  for (const l of vitalsList) {
    const m = /^\*\*Size:?\*\*:?\s*(.+)$/i.exec(l.replace(/^[-*]\s*/, '').trim())
    if (m) return m[1].trim()
  }
  return null
}

export function frequencyOf(marker: string): string | null {
  const m = /^\*\*(\w+) ability/i.exec(marker.trim())
  return m ? m[1].toLowerCase() : null
}
