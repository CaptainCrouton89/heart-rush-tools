# scripts/lib CLAUDE.md

Utility functions for the content compilation pipeline.

## Files

- **file-combiners.ts** - Config-driven file combining system for markdown sources:
  - Combines race files into `Kin_&_Culture.md`
  - Combines talent files (combat/noncombat/spells) into `Talents.md`
  - Combines Alaria world wiki categories into super-documents
  - Supports arbitrary nesting and separate sub-documents per subdirectory
- **content-processors.ts** - Splits markdown content by headers into structured sections
- **slug-generator.ts** - Generates URL-safe slugs from titles and headers
- **cross-references.ts** - Detects and resolves cross-references between content sections
- **navigation-builder.ts** - Constructs navigation trees with category normalization
- **index.ts** - Exports all utilities for use in compile-content.ts

## Key Functions

**file-combiners.ts:**
- **`combineRaceFiles()`** - Combines Heart Rush races via config-driven system
- **`combineTalentFiles()`** - Combines Heart Rush talents (combat/noncombat/spells) with header level adjustment
- **`combineAlariaFiles()`** - Processes all 7 Alaria world wiki categories, creating separate super-documents for regional subdirectories
- **`combineFromConfig(config)`** - Core generic combiner that processes a `CombinerConfig` object
- **`combineDirectoryFiles(sourceDir, headerLevelAdjust)`** - Combines markdown files from a single directory with optional header adjustment

**Other files:**
- **`splitContent(content, filename)`** (content-processors.ts) - Splits markdown by headers (H1-H6) into sections with metadata
- **`loadNavigationCategories(configPath)`** (navigation-builder.ts) - Loads navigation configuration from JSON
- **`createCategorizedNavigation(sections, categories)`** (navigation-builder.ts) - Builds navigation tree with category normalization

## Architecture

**Configuration-driven combining** uses two interfaces:
- **`CombinerConfig`** - Top-level config specifying source/output dirs, output name, optional intro file, and subdirectories array
- **`SubdirectoryConfig`** - Subdirectory config with `sourceDir`, optional `outputName` (creates separate super-document if set), optional `introFile`, and `headerLevelAdjust`

**Combining behavior:**
- If `outputName` is set, subdirectory becomes separate super-document with its own file
- If `outputName` is omitted, subdirectory merges into parent with optional intro and header level adjustment
- Header levels adjusted via `#`.repeat(adjustment) regex replacement on `^(#+)`
- Filenames auto-convert to headers if file doesn't start with H2 (`^##\s+`)
- Special files excluded: `CLAUDE.md`, `.claude-md-manager.md`, `_intro.md`

**Predefined configurations:**
- **`HEART_RUSH_COMBINERS`** - Race and talent combiners with intro files and header adjustments
- **`ALARIA_COMBINERS`** - 7 categories: Atlas (25 regional subdocs), Nations & Powers, Cosmology & Religion (Daemons, Planes, Celestial, Life & Death subdocs), History & Lore, Magic & Knowledge, Bestiary (Dragons, Diseases subdocs), Dramatis Personae

## Key Patterns

- Config-based approach eliminates per-category custom logic
- Subdirectory `outputName` controls whether it becomes separate document or merges into parent
- Header adjustment enables proper nesting when merging subdirectories
- Intro files handle category preamble and are required (fail-fast) when specified
- Title generation from filename uses underscore-to-space conversion
- Logging shows combined file counts for transparency

## Integration Points

- Used exclusively by `scripts/compile-content.ts` which calls `combineRaceFiles()`, `combineTalentFiles()`, and `combineAlariaFiles()`
- Output feeds into content processors for splitting and metadata generation
- Markdown sources in `heart_rush/` and `world-wikis/alaria/` → combined intermediates in `all_sections_formatted/` → JSON output via `src/lib/content.ts`
