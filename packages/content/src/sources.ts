// The inclusion manifest. Compiler inclusion is decided here, never by globbing a directory.
// Navigation trees follow rules-site-design "Information architecture".
import { kebab } from './util.ts'

export const PLAYER_DIR = 'heart_rush/all_sections_formatted'
export const GM_DIR = 'heart_rush/gm_guide'
export const RACES_DIR = 'heart_rush/races'
export const TALENTS_DIR = 'heart_rush/talents'
export const RACE_IMAGES_DIR = 'heart_rush/races/images'
export const ALARIA_DIR = 'world-wikis/alaria'

export const MAP_URL = 'https://world.alariawiki.online/'
export const SHEET_URL_PREFIX = 'https://docs.google.com/spreadsheets/d/1LaB8VcwgbskMt2Sdh6WKEKal1QRyPspl3WE1eHeL4ZU'
// Changes to https://play.heartrush.party/ in one edit once the play site serves a character sheet.
export const CHARACTER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LaB8VcwgbskMt2Sdh6WKEKal1QRyPspl3WE1eHeL4ZU/edit?gid=0#gid=0'

export type CatalogueRef = 'talents' | 'spells' | 'kin-culture'
export type Leaf = { label: string; file: string } | { label: string; catalogue: CatalogueRef }
export type Group = { label: string; slug: string; leaves: Leaf[] }

const group = (label: string, leaves: Leaf[]): Group => ({ label, slug: kebab(label), leaves })
const f = (label: string, file: string): Leaf => ({ label, file })

export const PLAYER_GROUPS: Group[] = [
  group('Start here', [f('Introduction', 'Intro'), f('How to play', 'How_To_Play'), f('Design manifesto', 'Heart_Rush_Manifesto')]),
  group('Build a character', [
    f('Building your character', 'Building_Your_Character'),
    { label: 'Kin & culture', catalogue: 'kin-culture' },
    { label: 'Talents', catalogue: 'talents' },
    f('Experience & advancement', 'Experience_&_Advancement'),
  ]),
  group('Core rules', [
    f('Dice mechanics & resolution', 'Dice_Mechanics_&_Resolution'), f('Abilities', 'Abilities'),
    f('Damage & consequences', 'Damage_&_Consequences'), f('Rests & healing', 'Rests_&_Healing'), f('Other factors', 'Other_Factors'),
  ]),
  group('Combat', [
    f('Combat', 'Combat'), f('Conditions', 'Conditions'), f('Weapons, cantrips & armor', 'Weapons,_Cantrips,_&_Armor'),
    f('Mounted combat & mounts', 'Mounted_Combat_&_Mounts'), f('Chases', 'Chase'),
  ]),
  group('Magic', [
    f('Magic', 'Magic'), f('Kethic elementalism', 'Kethic_Elementalism'), f('Cantrips', 'Cantrips'),
    { label: 'Spells', catalogue: 'spells' },
    f('Hematurgy: alternative magic', 'Hematurgy_Alternative_Magic'), f('Magical crafting', 'Magical_Crafting'),
  ]),
  group('Travel & equipment', [
    f('Journeys', 'Journeys'), f('Basic needs', 'Basic_Needs'), f('Equipment & gear', 'Equipment_&_Gear'),
    f('Wealth', 'Wealth_System'), f('Trading & merchants', 'Trading_&_Merchants'),
  ]),
  group('Larger-scale play', [f('Stratagem system', 'Stratagem_System'), f('Strongholds', 'Strongholds'), f('Paths', 'Paths'), f('Other rules', 'Misc._Other_Rules')]),
]

export const GM_GROUPS: Group[] = [
  group('Running the game', [f('Pacing', 'Pacing_Guide'), f('Timescale', 'Timescale')]),
  group('Encounters', [f('Running encounters', 'Running_Encounters'), f('Monster creation', 'Monster_Creation_Guide'), f('Monstrous races', 'Monstrous_Races')]),
  group('Travel', [f('Travel guide', 'Travel_Guide'), f('Weather & events', 'Weather_&_Events_Tables')]),
]

/** Generated aggregates that must never be indexed in addition to their originals. */
export const GENERATED_PLAYER = ['Kin_&_Culture', 'Talents']

// ---- Alaria ---------------------------------------------------------------
export type Topic = {
  stem: string            // legacy combined-book name (all_sections_formatted/<stem>.md)
  label: string
  dir: string             // primary source directory under world-wikis/alaria
  extraDirs?: string[]    // directories the legacy combiner inlined into this book
}
export type WorldCategory = { label: string; slug: string; topics: Topic[] }

const A = 'atlas_of_alaria'
export const ALARIA_HOME = { dir: `${A}/overview`, label: 'Alaria overview' }

export const WORLD_CATEGORIES: WorldCategory[] = [
  { label: 'Atlas', slug: 'atlas', topics: [
    { stem: 'Ve', label: 'Ve', dir: `${A}/ve`, extraDirs: [`${A}/alrock_ocean`] },
    { stem: 'Upoceax', label: 'Upoceax', dir: `${A}/upoceax`, extraDirs: ['seacliff_coast', 'farlands', 'sandreach', 'free_isles', 'sandreach_mountains', 'giant_lands', 'wycendeula', 'venalthier'].map((d) => `${A}/${d}`) },
    { stem: 'Aboyinzu', label: 'Aboyinzu', dir: `${A}/aboyinzu`, extraDirs: ['terrenia', 'central_aboyinzu', 'wanderlands', 'elder_wilds', 'dalizi', 'dragons_spine_coast', 'crimson_coast'].map((d) => `${A}/${d}`) },
    { stem: 'Clueanda', label: 'Clueanda', dir: `${A}/clueanda`, extraDirs: ['middle_sea', 'kharvorn_mountains', 'westwilds', 'frostmarch_peninsula', 'celedrim_plains', 'northlands', 'northern_isles'].map((d) => `${A}/${d}`) },
    { stem: 'Rimihuica', label: 'Rimihuica', dir: `${A}/rimihuica`, extraDirs: ['tarkhon', 'westrim', 'innerrim', 'emerald_coast', 'shacklands'].map((d) => `${A}/${d}`) },
    { stem: 'Greenwater_Isles', label: 'Greenwater Isles', dir: `${A}/greenwater_isles` },
    { stem: 'Western_Isles', label: 'Western Isles', dir: `${A}/western_isles` },
    { stem: 'Zylogmus_Eternus', label: 'Zylogmus Eternus', dir: `${A}/zylogmus_eternus` },
  ] },
  { label: 'Nations & powers', slug: 'nations-powers', topics: [
    { stem: 'States', label: 'States', dir: 'nations_and_powers/states' },
    { stem: 'City_States', label: 'City-states', dir: 'nations_and_powers/city_states' },
    { stem: 'Factions', label: 'Factions', dir: 'nations_and_powers/factions' },
    { stem: 'Daemons', label: 'Daemons', dir: 'nations_and_powers/daemons' },
  ] },
  { label: 'Cosmology & religion', slug: 'cosmology-religion', topics: [
    { stem: 'Alarian_Planar_Stack', label: 'Alarian planar stack', dir: 'cosmology_and_religion/alarian_planar_stack' },
    { stem: 'Planes', label: 'Planes', dir: 'cosmology_and_religion/alarian_planar_stack/planes' },
    { stem: 'Life_&_Death', label: 'Life & death', dir: 'cosmology_and_religion/life_death' },
    { stem: 'Beyond_Alaria', label: 'Beyond Alaria', dir: 'cosmology_and_religion/beyond_alaria' },
    { stem: 'Other_Planar_Stacks', label: 'Other planar stacks', dir: 'cosmology_and_religion/beyond_alaria/other_planar_stacks' },
  ] },
  { label: 'History & lore', slug: 'history-lore', topics: [
    { stem: 'Events', label: 'Events', dir: 'history_and_lore/events' },
    { stem: 'Timelines', label: 'Timelines', dir: 'history_and_lore/timelines' },
    { stem: 'Dramatis_Personae', label: 'Dramatis personae', dir: 'history_and_lore/dramatis_personae' },
    { stem: 'Artifacts', label: 'Artifacts', dir: 'history_and_lore/artifacts' },
  ] },
  { label: 'Magic & knowledge', slug: 'magic-knowledge', topics: [
    { stem: 'Deoric', label: 'Deoric', dir: 'magic_and_knowledge/deoric' },
    { stem: 'Faesong', label: 'Faesong', dir: 'magic_and_knowledge/faesong' },
    { stem: 'Gaeic_Melodies', label: 'Gaeic melodies', dir: 'magic_and_knowledge/gaeic_melodies' },
    { stem: 'Psy_Magic', label: 'Psy magic', dir: 'magic_and_knowledge/psy_magic' },
    { stem: 'Elemental_Magic', label: 'Elemental magic', dir: 'magic_and_knowledge/elemental_magic' },
    { stem: 'Schools', label: 'Schools', dir: 'magic_and_knowledge/schools' },
    { stem: 'Languages', label: 'Languages', dir: 'magic_and_knowledge/languages' },
    { stem: 'Materials', label: 'Materials', dir: 'magic_and_knowledge/materials' },
  ] },
  { label: 'Bestiary', slug: 'bestiary', topics: [
    { stem: 'Bestiary', label: 'Creatures', dir: 'bestiary' },
    { stem: 'Dragons', label: 'Dragons', dir: 'bestiary/dragons' },
    { stem: 'Diseases', label: 'Diseases', dir: 'bestiary/diseases' },
  ] },
]

// Terms linked in rules prose (bounded, exact). Everything else is the glossary's job.
// Target is [page path, heading anchor]. Verified at build: a missing target fails the build.
export const TERM_ALIASES: Array<{ terms: string[]; target: [string, string] }> = [
  { terms: ['heart die', 'heart dice'], target: ['/player/building-your-character', 'heart-die'] },
  { terms: ['advantage', 'disadvantage'], target: ['/player/dice-mechanics-resolution', 'advantage--disadvantage'] },
  { terms: ['wound', 'wounds'], target: ['/player/combat', 'wounds'] },
  { terms: ['short rest', 'short rests'], target: ['/player/rests-healing', 'short-rest'] },
  { terms: ['long rest', 'long rests'], target: ['/player/rests-healing', 'long-rest'] },
  { terms: ['rests', 'rest'], target: ['/player/rests-healing', 'rests'] },
  { terms: ['stance', 'stances'], target: ['/player/combat', 'understanding-stances'] },
  { terms: ['the engagement'], target: ['/player/combat', 'the-engagement'] },
]

/** Explicit synonyms and source spellings, per page path. */
export const ALIASES: Record<string, string[]> = {
  '/player/kin-culture': ['Races', 'Race'],
  '/gm/monstrous-races': ['Monsterous Races'],
}

// Link map: corrections for source links that cannot resolve as written. Everything else that fails is reported.
/** The overview's links are written relative to atlas_of_alaria/, not to its own folder. */
export const LINK_BASE_OVERRIDES: Record<string, string> = {
  'world-wikis/alaria/atlas_of_alaria/overview/_intro.md': 'world-wikis/alaria/atlas_of_alaria',
}
/** Whole-link corrections, keyed by the link path as written: the repo file it was meant to reach. */
export const LINK_FIXES: Record<string, string> = {
  '../../bestiary/dragons/Pyaganos.md': 'world-wikis/alaria/atlas_of_alaria/ve/Pyaganos.md',
  '../../bestiary/dragons/Draphilir.md': 'world-wikis/alaria/atlas_of_alaria/ve/Draphilir.md',
  '../../dramatis_personae/Bzulakar.md': 'world-wikis/alaria/history_and_lore/dramatis_personae/Bzulakar.md',
  '../dramatis_personae/Phendexelas.md': 'world-wikis/alaria/history_and_lore/dramatis_personae/Phendexelas the Beautiful.md',
}
/** Substring rewrites on a link path before resolving (source folder renamed after the link was written). */
export const LINK_REWRITES: Record<string, string> = {
  'seacleft_coast/': 'seacliff_coast/',
}
