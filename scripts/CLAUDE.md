# Scripts Directory

Contains the content compilation pipeline for the Heart Rush Digital Rulebook.

## Core Script: `compile-content.ts`

Main content compilation engine with three compilation functions:

**Player Content** (`compilePlayerContent`):
- Combines race files into `Kin_&_Culture.md` and talent files into `Talents.md`
- Processes rulebook markdown and splits by headers into sections
- Copies race images to public directory and associates them with race sections
- Generates slugs, metadata, cross-references, and navigation trees
- Outputs individual section JSON files and `navigation.json` + `index.json` to `content/` directory

**GM Content** (`compileGMContent`):
- Processes GM-specific content from `heart_rush/gm_guide/`
- Supports custom navigation categories via `gm-navigation-categories.json`
- Outputs to `content/gm/` directory

**World Wikis** (`compileAllWorldWikis`):
- Auto-discovers world directories in `world-wikis/`
- Supports custom `navigation-categories.json` per world
- Outputs to `content/worlds/[world-name]/` directory

**Run:** `pnpm run compile-content` or `pnpm run content:watch` (watch mode)

## Lib Directory

Contains utility modules referenced by compile-content.ts:

- `types.ts` - TypeScript definitions (`ContentSection`, etc.)
- `utils.ts` - Slug generation, word counting, reading time calculation, tag/cross-reference extraction
- `content-processors.ts` - Content splitting by headers, section extraction
- `file-combiners.ts` - Race file combining, talent file combining, world wiki file combining
- `navigation-builder.ts` - Navigation tree generation from sections and categories
- `image-handler.ts` - Race image copying and lookup for Kin & Culture sections
