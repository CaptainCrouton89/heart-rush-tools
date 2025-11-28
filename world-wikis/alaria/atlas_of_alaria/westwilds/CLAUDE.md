# Westwilds - Content Guidelines

The Westwilds directory contains geographic and landmark content for the western wilderness region of Clueanda.

## Directory Organization

Files represent distinct regions and geographic features within the westwilds:
- Regional overview and landmark files (e.g., `Everwood.md`, `Wildwood.md`)
- Terrain features (e.g., `Piktiniti Desert.md`, `Krenglelan Range.md`)
- Named locations and cities (e.g., `Chakatann.md`, `Melodia.md`)
- **_intro.md** - Main westwilds overview with hierarchical navigation

## File Structure Pattern

Each regional file follows this structure:
```markdown
## Region/Feature Name

[Overview paragraph explaining the region]

### Major Location/City (if applicable)

[Description of significant locations within the region]

#### Notable Sites/Landmarks (if applicable)

[Points of interest, dungeons, notable features]
```

## Content Consolidation

Follow these guidelines:
- **Don't create tiny files** - Keep related locations consolidated under their parent region
- **Use subsections** - Major cities and landmarks within a region are H3/H4 subsections
- **Link to external content** - Cross-reference entries in `bestiary/`, `nations_and_powers/`, and other categories

## Cross-References

When referencing creatures, factions, or other content:
- Link to `../../bestiary/` for creatures and peoples
- Link to `../../nations_and_powers/` for kingdoms and factions
- Use relative paths for clarity and maintainability

## Development Notes

- Content is part of the Alaria atlas compile system
- Run `pnpm run content:watch` for live recompilation during editing
- Changes automatically generate URL slugs and navigation metadata
- Maintain consistency with established tone and detail level across files
