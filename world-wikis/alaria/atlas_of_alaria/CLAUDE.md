# Atlas of Alaria - Regional Organization

This subdirectory contains the geographic and landmark content for the Alaria world wiki.

## Core Principle: Consolidation Over Fragmentation

**We do NOT want 1000 tiny files.** Geographic content should be consolidated into regional files with subsections. A region file should contain:
- Overview of the region (H2)
- Major locations as H3 subsections
- Points of interest, dungeons, landmarks as H4 subsections under their parent location

Example structure:
```markdown
## Region Name

Overview of the region...

### Major City/Area

Description of the city...

#### Notable Landmark

Description of the landmark within the city...

### Another Location

...
```

## Content Placement Rules

1. **Locations belong to their parent region** - Don't create standalone files for individual POIs, dungeons, or landmarks. Add them as subsections to existing regional files.

2. **NPCs go in dramatis_personae/** - Characters, rulers, wizards, etc. are not atlas entries.

3. **Organizations go in nations_and_powers/** - Factions, guilds, governments belong there, not here.

4. **Planes/Cosmology go in cosmology_and_religion/planes/** - Planar locations like Malstaris, Phlethageros, etc.

5. **Magic schools go in magic_and_knowledge/schools/** - Academies and magical institutions.

## Continental Structure

Alaria comprises these major continents (see `Major_Continents.md` for overview):

### Ve (Eastern Continent)
- **ve/** - Main Ve territories
- **alrock_ocean/** - Ocean region with Vetral, Keletus, Albersea Islands

### Upoceax
- **wycendeula/** - Northern frozen wastes
- **giant_lands/** - Giant territories
- **farlands/** - Distant frontier
- **sandreach/** - Desert regions
- **sandreach_mountains/** - Desert mountain ranges
- **venalthier/** - Venalthier territories
- **seacleft_coast/** - Clifftop coastal areas (includes Gyosha Island)

### Aboyinzu
- **terrenia/** - (to be created)
- **wanderlands/** - Nomadic territories
- **elder_wilds/** - Ancient wilderness
- **dragons_spine_coast/** - Dragon's Spine coastal regions
- **dalizi/** - Dalizi territories
- **crimson_coast/** - Crimson coastal regions
- **central_aboyinzu/** - Central Aboyinzu

### Clueanda (Central Continent)
- **westwilds/** - Western wilderness
- **kharvorn_mountains/** - Major mountain ranges
- **middle_sea/** - Central sea and surrounding nations (Adron, Anarak, etc.)
- **northlands/** - Far north (includes Titanwurm Mountains in tundra)
- **celedrim_plains/** - Vast plains
- **frostmarch_peninsula/** - Frozen peninsula

### Rimihuica
- **westrim/** - Western rim (Mueras, Ishnit Jungles, Dunes of Kunagi)
- **emerald_coast/** - Emerald coastal regions
- **innerrim/** - Inner rim territories
- **shacklands/** - Lawless frontier (Gorath, etc.)

### Island Regions
- **free_isles/** - Independent pirate/merchant islands
- **greenwater_isles/** - Tropical archipelago
- **western_isles/** - Western island chains (Dragon's Teeth, Vel Ithagas)
- **northern_isles/** - Arctic islands (Foggy Isles, Bzulakar's domain)

### Special Regions
- **underrealms/** - Underground megadungeon system
- **zylogmus_eternus/** - Major megadungeon (includes The Wastes)
- **upoceax/** - Continental overview
- **tarkhon/** - Tarkhon Empire territories

## File Structure

Each regional directory contains:
- **_intro.md** - Main regional file with overview and consolidated location content
- Additional .md files only for very large sub-regions that warrant separation

## When to Create a New File vs. Add a Subsection

**Create a new file when:**
- The location is a major nation/state with extensive content
- The sub-region has 5+ distinct locations of its own
- Content would exceed ~500 lines in the parent file

**Add as a subsection when:**
- It's a POI, dungeon, landmark, or minor location
- It's a city/town within a larger region
- It's a geographic feature (mountain, river, forest) within a region

## Cross-References

When a location is detailed elsewhere but should be mentioned in the atlas:
```markdown
### Location Name

Brief description with link to full entry in [dramatis_personae](../../dramatis_personae/Character.md) or other section.
```

## Development Notes

- Run `pnpm run content:watch` for live recompilation
- Update `navigation-categories.json` when adding new regional directories
- Prefer editing existing regional files over creating new standalone files
