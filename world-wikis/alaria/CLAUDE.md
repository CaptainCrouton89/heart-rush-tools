# Alaria World Wiki

A comprehensive, organized knowledge base for world-building in Alaria, the Heart Rush TTRPG setting.

## Directory Structure

Content is organized by category, each with its own subdirectory:

- **all_sections_formatted/** - Combined content sections and narratives
- **atlas_of_alaria/** - Physical geography, landmarks, and regions
- **nations_and_powers/** - Civilizations, governments, and factions
- **cosmology_and_religion/** - The universe, planes, deities, and divine forces
- **history_and_lore/** - Historical events, timelines, and narratives
- **magic_and_knowledge/** - Magical systems, schools of magic, and arcane knowledge
- **bestiary/** - Creatures, monsters, and fauna
- **maps/** - Interactive and reference maps

## Content Compilation & Integration

Alaria content is compiled by the main build system (`scripts/compile-content.ts`) into JSON structures that power the world wiki in the app:

- Each markdown file in category subdirectories becomes a navigable page
- Filenames become URL slugs (spaces → hyphens, lowercase)
- Content is hierarchically organized by category for navigation trees
- Cross-references between sections are automatically resolved during compilation
- Navigation driven by `navigation-categories.json` configuration

Run `pnpm run compile-content` from the project root to rebuild the world wiki.

## Navigation & Structure

The `navigation-categories.json` file defines:
- **Categories** - Top-level wiki sections (Atlas of Alaria, Nations & Powers, etc.)
- **Icons** - Visual identifiers for each category
- **Descriptions** - Brief category summaries for UI display
- **Sections** - Subsection mappings within each category (correspond to subdirectory names with underscores converted to spaces)

Each markdown file in category subdirectories becomes a navigable page with auto-generated slugs and navigation metadata.

## Writing Guidelines

- **Markdown Format**: Use standard markdown with clear heading hierarchy (H2 for major sections, H3 for subsections)
- **Cross-References**: Use `[link text](../path/to/file)` for references between Alaria documents
- **Consistency**: Maintain established tone and detail level when expanding existing entries
- **File Naming**: Use descriptive names with underscores for spaces (e.g., `The_Seven_Houses.md`)
- **Front Matter**: No YAML front matter required—compilation system generates metadata

## Development Notes

- Content is authored in Markdown files within category subdirectories
- Run `pnpm run content:watch` for live recompilation during editing
- Changes to `navigation-categories.json` require recompilation to take effect
- Commit changes with clear messages describing what lore was added/updated
