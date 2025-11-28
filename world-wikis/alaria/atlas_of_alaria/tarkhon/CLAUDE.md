# Tarkhon - Regional Organization

Content for the Tarkhon Empire and its territories within the Atlas of Alaria.

## Regional Structure

Tarkhon is organized as a consolidated regional directory following the Atlas consolidation principle: **one primary regional file with subsections for locations, not fragmented standalone files.**

### Core Files

- **_intro.md** - Main Tarkhon overview with consolidated content about the empire, its territories, and major locations as subsections
- Individual .md files - **Only for major imperial territories or cities that warrant extensive standalone content** (currently: Enymu, Gissemari, Kabir, Murth, Wadiyah, Yaif)
- **Wurn Mountains.md** - Major geographic feature within Tarkhon

## Content Guidelines

### When Adding to _intro.md vs. Creating a New File

**Add as H3 subsection in _intro.md when:**
- It's a minor city, town, or POI within Tarkhon
- It's a landmark or geographic feature
- Content would be <200 lines

**Create a new standalone file when:**
- It's a major imperial city or capital territory
- Content exceeds ~300 lines
- The location has extensive cross-references to other world sections (nations_and_powers, bestiary, etc.)

### Cross-References

When referencing Tarkhon locations elsewhere:
- Link to appropriate section in this directory
- For empire-level content, link to `/nations_and_powers/states/Tarkhon Empire.md`
- For inhabitants/cultures, check `bestiary/` for existing entries first

### Organization Conventions

- Use H2 for Tarkhon Empire overview in _intro.md
- Use H3 for major imperial territories and regional subdivisions
- Use H4 for cities, landmarks, and POIs within territories
- Maintain consistent tone reflecting Tarkhon's role as a major civilized empire

## Related Content

- **Nations & Powers**: `/nations_and_powers/states/Tarkhon Empire.md` - Political structure, government, history
- **Bestiary**: Check for Tarkhon-specific peoples and cultures
- **Magic & Knowledge**: Tarkhon magical traditions and institutions

## Development Notes

- Run `pnpm run content:watch` for live recompilation during editing
- Keep _intro.md as the primary hub; avoid creating unnecessary standalone files
- When expanding a subsection significantly, consider moving to standalone file and linking from _intro.md
