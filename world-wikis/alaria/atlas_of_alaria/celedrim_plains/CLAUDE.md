# Celedrim Plains - Regional Guide

The Celedrim Plains is a vast grassland region in northern Clueanda with diverse geographic and cultural features. Content is organized as individual location files representing major geographic areas.

## File Organization

Each markdown file represents a distinct geographic location or major region:
- **_intro.md** - Regional overview and consolidated narrative
- Individual files (Dreamplains.md, Jotunhills.md, etc.) - Major locations with internal subsections

Files use H2 headers for the main location, H3 for significant areas within it, and H4 for specific landmarks or POIs.

## Content Standards

- **Heading Structure**: H2 for location name, H3 for major sub-areas, H4 for landmarks/POIs
- **Subsection Approach**: Organize content within a location file by meaningful geographic or cultural divisions
- **Tags**: Include relevant tags at the top (e.g., `Tags: plains, tundra`)
- **Descriptions**: Keep atmospheric and evocative while providing useful navigation context
- **Cross-References**: Link to related entries in bestiary, nations_and_powers, cosmology_and_religion when appropriate

## Cross-Reference Guidelines

When linking to other atlas regions or world wiki sections:
```markdown
[Link text](../../category_name/file_name.md)
[Link text](../other_region/file_name.md)
```

Common reference targets:
- **bestiary/** - Creatures and peoples inhabiting the Celedrim Plains
- **nations_and_powers/states/** - Political entities and factions
- **cosmology_and_religion/** - Divine sites, magical locations
- **history_and_lore/** - Historical events tied to this region

## Tone and Style

- Maintain consistent tone with established Alaria lore
- Ground descriptions in concrete details (temperatures, sounds, physical features)
- Include practical information for travelers (dangers, opportunities, navigation hazards)
- Layer in mystery and atmosphere without sacrificing clarity

## Development Notes

- Run `pnpm run content:watch` for live recompilation during editing
- Changes compile automatically to world wiki navigation
- Commit with clear messages describing geographic/lore additions
