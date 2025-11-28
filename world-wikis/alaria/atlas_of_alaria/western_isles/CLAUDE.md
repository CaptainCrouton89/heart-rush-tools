# Western Isles - Regional Organization

The Western Isles are a major island region containing Dragon's Teeth, Vel Ithagas, Istokos, and associated island chains and archipelagos off Clueanda's western coast.

## File Organization

This directory contains individual files for each significant island, archipelago, and geographic feature in the Western Isles. Each location receives its own file when it has distinct geographic, cultural, political, or narrative significance.

### When to Use Individual Files

Individual files are appropriate for:
- **Nations/States** - Istokos, Sheîr, Knova (have governance, territory, culture)
- **Major Archipelagos** - Ember Isles (Firefell), Islands of Gold, Foggy Isles (organized island clusters)
- **Significant Geographic Features** - Phyndarr Sound, Sea of Sharks, Stratlan Sea (distinct regional locations)
- **Cultural Centers** - Iron Academy, Bynu Island Tribes (notable population centers or peoples)
- **Locations Exceeding ~300 Lines** - Detailed content warrants its own file for navigability

### File Structure

Each location file should follow this pattern:
- **H2 heading**: Location name (e.g., `## Istokos`)
- **Tags line**: `Tags: [type], [type]` (e.g., `Tags: state, nation`)
- **Introduction**: Brief overview of geographic, political, or cultural significance
- **H3 subsections**: Major features, cities, landmarks, or regions within the location
- **H4 subsections**: Details within subsections (districts, notable places, specific features)

### Content Standards

- **Geographic Focus**: Terrain, climate, position relative to other regions, travel/navigation
- **Cultural/Political**: Societies, governance, economic focus where relevant to the setting
- **Cross-References**: Link to bestiary for inhabitants, nations_and_powers/ for states/factions
- **Scope**: Don't duplicate NPCs (dramatis_personae/) or detailed faction info (nations_and_powers/)
- **Consistency**: Maintain tone and detail level with broader Alaria lore

### Cross-Referencing

For locations mentioned across multiple files:
```markdown
See also [Related Location](./Related_Location.md) for additional context.
```

## Development Notes

- Run `pnpm run content:watch` during editing for live recompilation
- Update navigation configuration if adding new top-level island groupings
- Prefer individual files over subsections for locations with substantial independent content
