# Scripts Directory

This directory contains utility scripts for content compilation, processing, and maintenance of the Heart Rush Digital Rulebook.

## Key Scripts

### `compile-content.ts`

Core content compilation pipeline with three main compilation functions:

**Player Content** (`compilePlayerContent`):
- Combines race files from `heart_rush/races/` into `Kin_&_Culture.md`
- Combines talent files from `heart_rush/talents/` into `Talents.md`
- Copies race images to public directory
- Processes all markdown files and splits by headers into sections
- Generates slugs, metadata, cross-references, and navigation trees
- Outputs structured JSON to `content/` directory

**GM Content** (`compileGMContent`):
- Processes GM-specific content from `heart_rush/gm_guide/`
- Uses custom GM navigation categories from `gm-navigation-categories.json`
- Generates categorized navigation alongside standard navigation
- Outputs to `content/gm/` directory

**World Wikis** (`compileAllWorldWikis`):
- Auto-discovers world directories in `world-wikis/`
- Recursively scans for markdown files in any subdirectory structure
- Supports custom `navigation-categories.json` per world
- Falls back to auto-generated categories from content if not present
- Outputs to `content/worlds/[world-name]/` directory

**Run with**: `pnpm run compile-content` or `pnpm run content:watch` (watch mode)

## Lib Modules

### `types.ts`
TypeScript type definitions for content sections and navigation structures.

### `utils.ts`
Utility functions:
- `generateSlug()` - Create URL-safe slugs with collision detection
- `countWords()` - Calculate word count for content
- `calculateReadingTime()` - Estimate reading time
- `extractTags()` - Extract tags from content and title
- `extractCrossReferences()` - Find cross-reference links

### `file-combiners.ts`
Functions for combining distributed markdown files:
- `combineRaceFiles()` - Merge race files into single Kin_&_Culture.md
- `combineTalentFiles()` - Merge talent files into single Talents.md

### `content-processors.ts`
Content transformation utilities:
- `splitContent()` - Split markdown by headers into sections

### `navigation-builder.ts`
Navigation structure generation:
- `loadNavigationCategories()` - Load categories from config file
- `createCategorizedNavigation()` - Build hierarchical navigation tree

### `image-handler.ts`
Image management for race content:
- `copyRaceImages()` - Copy race images to public directory
- `findRaceImage()` - Locate image for specific race

## Important Notes

- Scripts must be run in TypeScript/Node context using `tsx` or `pnpm`
- Content compilation is automatically triggered before `dev` and `build` commands
- All scripts should output to `content/` directory (gitignored) or generate build artifacts
- Type safety is enforced (no `any` types)
- Scripts are part of the build pipeline and must handle errors gracefully
- Parent relationships are established within file scope only (subsections within same file)
- Slug collisions are tracked and resolved globally across all content

