# Alaria Bestiary

Comprehensive catalog of creatures, monsters, dragons, and fauna in the Alaria world.

## Directory Structure

- **Root level** - Individual creature and monster entries
- **dragons/** - Named dragons and dragon-specific content
- **diseases/** - Magical diseases and afflictions

## Content Categories

### Creature Entries

Bestiary entries cover:
- **Intelligent Races & Societies** (e.g., Twaan, Shazuihni) - Include cultural/societal details, relations to other groups, habitats
- **Monsters & Threats** (e.g., Gallows Giant, Denvil Iron Claw) - Combat encounters, habitats, behavior
- **Beasts & Animals** (e.g., Desert Mammoth, Lightning Raptor) - Natural fauna, ecology
- **Supernatural Entities** (e.g., Ghosts, Liches, Specters) - Otherworldly creatures, metaphysical nature
- **Collectives** (e.g., Undead, Dragons, Wyverns) - Category pages covering creature types with multiple variants

### Dragons

Named dragons and dragon-type creatures are housed in the `dragons/` subdirectory. Each dragon entry should include:
- Personality and disposition
- Physical description
- Historical significance or notability
- Lair/habitat location (cross-reference to atlas entries)
- Threat level or unique abilities
- Relationships with other dragons or world powers

### Diseases

Magical diseases and afflictions are in the `diseases/` subdirectory.

## Writing Guidelines

### Structure & Format

- **Opening description** - 2-3 sentences establishing the creature's nature and significance
- **Key sections** - Organized with H3 headings:
  - For intelligent races: Society, Culture, Relations, Homeland
  - For monsters: Behavior, Habitat, Threats, Notable Specimens
  - For supernatural: Origin, Nature, Manifestation, Interactions
- **Cross-references** - Link to related atlas, nation, or faction entries using relative paths

### Style & Tone

- Write from a world-building perspective (not game mechanics)
- Emphasize the creature's role in Alaria's ecosystem and lore
- For intelligent races: Include their perspective and agency
- For monsters: Focus on behavior, ecology, and cultural significance
- Avoid stat blocks or mechanical game details (rulebook is separate)

### Metadata

Use inline tags for categorization:
```
Tags: race, category, region/landmark
```

Examples:
- `Tags: race, skaag, westwilds` - For Twaan entry
- `Tags: dragon, ancient, kharvorn` - For named dragons
- `Tags: disease, magical, contagion` - For diseases

### Cross-Referencing

- Link to **atlas entries**: `[Twaan Forests](../atlas_of_alaria/westwilds/Twaan%20Forests.md)`
- Link to **nation entries**: `[Tarkhon Empire](../nations_and_powers/states/Tarkhon%20Empire.md)`
- Link to other **bestiary entries**: `[Dragons](Dragons.md)` or `[dragons/Nyinsylys](dragons/Nyinsylys.md)`
- Use relative paths and URL-encode spaces (`%20`)

## Compilation & Integration

Bestiary content compiles into the Alaria world wiki via `scripts/compile-content.ts`:
- Each markdown file becomes a navigable page in `/world/alaria/...`
- Filenames become URL slugs (lowercase, spaces → hyphens)
- Hierarchical navigation generated from directory structure and front matter
- Cross-references automatically resolved during compilation

Run `pnpm run compile-content` to rebuild after changes.

## Development Notes

- Use `pnpm run content:watch` for live recompilation during editing
- Maintain consistent tone and detail level with existing entries
- Coordinate with atlas entries (regions referenced should exist)
- Check cross-reference paths before committing
- Commit with clear messages: `docs(bestiary): add [creature name]` or `docs(bestiary): expand [entry name]`
