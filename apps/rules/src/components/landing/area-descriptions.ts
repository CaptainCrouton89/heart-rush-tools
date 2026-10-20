// One sentence describing each group landing that has no authored source text (the compiler emits description: null
// for these navigation-only pages). Keyed by page id; landings with a source description use that instead.
export const AREA_DESCRIPTIONS: Record<string, string> = {
  player: 'The rules every player uses: playing a session, building a character, combat, magic, travel and larger-scale play.',
  gm: 'Guidance for the person running the game: pacing, encounters and travel.',
  worlds: 'The settings Heart Rush is played in.',
  'player.topics.start-here': 'What Heart Rush is, how a session plays, and the principles behind its design.',
  'player.topics.build-a-character': 'Making a character: the building steps, kin and culture, talents, and how characters advance.',
  'player.topics.core-rules': 'The rules used in every scene: dice and resolution, abilities, damage, rests and other factors.',
  'player.topics.combat': 'Fighting: the combat rules, conditions, weapons and armor, mounted combat and chases.',
  'player.topics.magic': 'How magic works: Kethic elementalism, cantrips, spells, hematurgy and magical crafting.',
  'player.topics.travel-equipment': 'Journeys, basic needs, equipment, wealth and trade.',
  'player.topics.larger-scale-play': 'Play beyond the party: stratagems, strongholds, paths and other rules.',
  'gm.topics.running-the-game': 'Keeping a session moving: pacing and the two timescales of play.',
  'gm.topics.encounters': 'Building and running fights: encounters, monster creation and monstrous races.',
  'gm.topics.travel': 'Running journeys: the travel guide and the weather and event tables.',
  'worlds.alaria.topics.atlas': 'The continents and island groups of Alaria, region by region.',
  'worlds.alaria.topics.nations-powers': 'The states, city-states, factions and daemons that hold power in Alaria.',
  'worlds.alaria.topics.cosmology-religion': 'The planar stack around Alaria, its planes, life and death, and what lies beyond.',
  'worlds.alaria.topics.history-lore': "Alaria's events, timelines, notable people and artifacts.",
  'worlds.alaria.topics.magic-knowledge': 'The magic traditions, schools, languages and materials of Alaria.',
  'worlds.alaria.topics.bestiary': 'The creatures, dragons and diseases of Alaria.',
}

export function areaDescription(id: string, description: string | null): string | null {
  return description ?? AREA_DESCRIPTIONS[id] ?? null
}
