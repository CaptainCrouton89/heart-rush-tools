# Atlas of Alaria - Regional Organization

This subdirectory contains the geographic and landmark content for the Alaria world wiki, organized into regional sections for scalability and ease of navigation.

## Directory Structure

The Atlas is organized into **regional subdirectories**, each representing a major geographic area in Alaria:

- **celedrim_plains/** - The vast plains of Celedrim
- **central_aboyinzu/** - Central regions of Aboyinzu
- **crimson_coast/** - Crimson-hued coastal regions
- **dalizi/** - The Dalizi territories
- **dragons_spine_coast/** - Coastal regions along the Dragon's Spine
- **elder_wilds/** - Ancient wilderness areas
- **emerald_coast/** - Coastal regions of the Emerald Sea
- **farlands/** - Distant and exotic frontier regions
- **free_isles/** - Independent island territories
- **frostmarch_peninsula/** - Northern frozen territories
- **giant_lands/** - Territories inhabited by giants
- **greenwater_isles/** - Island archipelagos
- **innerrim/** - Inner rim regions
- **kharvorn_mountains/** - Mountain ranges in the north
- **middle_sea/** - Central sea and maritime regions
- **northern_isles/** - Northern island territories
- **northlands/** - The far north
- **sandreach/** - Desert and sandland regions
- **sandreach_mountains/** - Mountain ranges in sandreach
- **seacliff_coast/** - Clifftop coastal areas
- **shacklands/** - Lawless and frontier territories
- **tarkhon/** - The Tarkhon regions
- **ve/** - The Ve territories
- **venalthier/** - Venalthier regions
- **wanderlands/** - Nomadic and wandering territories
- **western_isles/** - Western island chains
- **westrim/** - Western rim territories
- **westwilds/** - Western wilderness
- **wycendeula/** - The Wycendeula region

## Content Organization

Within each regional subdirectory:

- **Files named after specific locations, landmarks, or regions** - Each markdown file represents a distinct geographic area or point of interest
- **File naming**: Use descriptive names with underscores for spaces (e.g., `Grand_Tolkarsus.md`, `Krell_Lands.md`)
- **Content scope**: Each file focuses on a single location or closely related geographic feature within the region

## Compilation & Navigation

- Content is compiled by `scripts/compile-content.ts` using the hierarchy defined in `navigation-categories.json`
- Each region becomes a navigable section in the world wiki
- Locations within regions are browsable and searchable
- Cross-references between regional content are automatically resolved

## Writing Guidelines

- **Markdown Format**: Standard markdown with H2 for major sections, H3 for subsections
- **Geographic Context**: Include regional relationships and connections to neighboring areas
- **Consistency**: Maintain established tone and detail level across all regional content
- **Cross-References**: Use relative paths to reference other Alaria content (e.g., `../cosmology_and_religion/Planes.md`)
- **Location Details**: Include descriptions of geography, notable features, inhabitants, and points of interest

## Development Notes

- Run `pnpm run content:watch` for live recompilation when editing atlas content
- Regional organization scales well as the world grows
- When adding new regions, create a new subdirectory and update `navigation-categories.json`
- Archive deprecated locations in the parent `archive/` directory rather than deleting them
- Commit changes with clear messages describing what geographic content was added/updated
