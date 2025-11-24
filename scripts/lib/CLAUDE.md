# scripts/lib CLAUDE.md

Utility functions for the content compilation pipeline.

## Files

- **file-combiners.ts** - Combines multiple markdown source files into single files:
  - Race files → `Kin_&_Culture.md`
  - Talent/combat/noncombat/spell files → `Talents.md`
  - World wiki category directories → combined category files
- **content-processors.ts** - Splits markdown content by headers into structured sections
- **slug-generator.ts** - Generates URL-safe slugs from titles and headers
- **cross-references.ts** - Detects and resolves cross-references between content sections
- **navigation-builder.ts** - Constructs navigation trees with category normalization
- **index.ts** - Exports all utilities for use in compile-content.ts

## Key Functions

**content-processors.ts:**
- **`splitContent(content, filename)`** - Splits markdown by headers (H1-H6) into sections with metadata

**file-combiners.ts:**
- **`combineRaceFiles()`** - Merges individual race markdown files into `Kin_&_Culture.md`
- **`combineTalentFiles()`** - Merges combat, noncombat, and spell files into `Talents.md` with section headers
- **`combineWorldWikiFiles(worldName)`** - Orchestrates combining world wiki categories and returns generated file paths
- **`combineWorldWikiCategory(worldName, categoryDir)`** - Combines nested markdown files in a category
- **`recursivelyCollectMarkdownFiles(dir, basePath)`** - Recursively collects markdown files from nested directories

**navigation-builder.ts:**
- **`loadNavigationCategories(configPath)`** - Loads navigation configuration from JSON
- **`createCategorizedNavigation(sections, categories)`** - Builds navigation tree with category normalization (handles "And"/"&" mismatches)
- **`normalizeCategoryName(name)`** - Normalizes category names for consistent matching

## Key Patterns

- File combiners filter out `CLAUDE.md` and `.claude-md-manager.md` files
- Category names normalized by converting `&` to `and` before matching (prevents "Other" section creation)
- World wiki categories support arbitrary nesting depth
- Navigation building requires optional `navigation-categories.json` config file
- Section splitting handles edge cases: no headers, content before first header, empty sections

## Integration Points

- Used exclusively by `scripts/compile-content.ts`
- Output feeds into `src/lib/content.ts` for runtime loading
- Markdown sources in `heart_rush/` → JSON output in `content/` (gitignored)
- World wiki sources in `world-wikis/[world]/` → combined intermediates → JSON output in `content/worlds/[world]/`
