# Scripts Directory

This directory contains utility scripts for content compilation, processing, and maintenance of the Heart Rush Digital Rulebook.

## Key Scripts

### `compile-content.ts`
Core content compilation pipeline that:
- Combines race files from `heart_rush/races/` into `Kin_&_Culture.md`
- Combines talent files from `heart_rush/talents/` into `Talents.md`
- Processes all markdown files and splits by headers into sections
- Generates slugs, metadata, cross-references, and navigation trees
- Outputs structured JSON to `content/` and `content/gm/` directories

**Run with**: `pnpm run compile-content` or `pnpm run content:watch` (watch mode)

### `lib/` Subdirectory
Shared utilities used by compilation scripts:
- `file-combiners.ts` - Functions for combining race and talent markdown files
- Other helper modules for content processing

## Important Notes

- Scripts must be run in TypeScript/Node context using `tsx` or `pnpm`
- Content compilation is automatically triggered before `dev` and `build` commands
- All scripts should output to `content/` directory (gitignored) or generate build artifacts
- Type safety is enforced (no `any` types)
- Scripts are part of the build pipeline and must handle errors gracefully
