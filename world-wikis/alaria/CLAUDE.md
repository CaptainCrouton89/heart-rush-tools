# Alaria World Wiki

A comprehensive, organized knowledge base for world-building in Alaria, the Heart Rush TTRPG setting.

## Directory Structure

Content is organized by category, each with its own subdirectory:

- **atlas_of_alaria/** - Physical geography, landmarks, regions, and maps
- **nations_and_powers/** - Civilizations, governments, organizations, and factions
- **cosmology_and_religion/** - The universe, planes, deities, and divine forces
- **history_and_lore/** - Historical events, timelines, and world-shaping narratives
- **magic_and_knowledge/** - Magical systems, schools of magic, and arcane knowledge
- **bestiary/** - Creatures, monsters, fauna, and non-player characters
- **dramatis_personae/** - Important NPCs, historical figures, and notable individuals
- **maps/** - Interactive and reference maps for the world
- **archive/** - Deprecated or archived content (kept for reference)

## Content Compilation & Integration

Alaria content is compiled by the main build system (`scripts/compile-content.ts`) into JSON structures that power the world wiki in the app:

- Each markdown file in category subdirectories becomes a navigable page
- Filenames become URL slugs (spaces → hyphens, lowercase)
- Content is hierarchically organized by category for navigation trees
- Cross-references between sections are automatically resolved during compilation
- Navigation driven by `navigation-categories.json` configuration

Run `pnpm run compile-content` from the project root to rebuild the world wiki.

## Navigation System

- `navigation-categories.json` - Defines the category hierarchy, icons, descriptions, and section mappings
- Structure determines how categories appear in the app UI and navigation menus
- Update this file when adding new categories or reorganizing sections

## Writing Guidelines

- **Markdown Format**: Use standard markdown with clear heading hierarchy (H2 for major sections, H3 for subsections)
- **Cross-References**: Use `[link text](../path/to/file)` for references between Alaria documents
- **Consistency**: Maintain established tone and detail level when expanding existing entries
- **Front Matter**: No YAML front matter required—compilation system generates metadata
- **File Naming**: Use descriptive names with underscores for spaces (e.g., `The_Seven_Houses.md`)

## Development Notes

- Content is authored in Markdown files within category subdirectories
- The compilation system generates URLs, navigation trees, and cross-reference metadata automatically
- Run content watcher with `pnpm run content:watch` for live recompilation during editing
- Archive directory preserves superseded content without cluttering active sections
- Commit changes with clear messages describing what lore was added/updated
