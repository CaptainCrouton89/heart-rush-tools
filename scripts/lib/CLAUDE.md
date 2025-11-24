# scripts/lib CLAUDE.md

Utility functions for the content compilation pipeline.

## Files

- **file-combiners.ts** - Combines multiple markdown source files into single files (races, talents)
- **markdown-parser.ts** - Parses markdown content into structured sections with metadata
- **slug-generator.ts** - Generates URL-safe slugs from titles and headers
- **cross-references.ts** - Detects and resolves cross-references between content sections
- **nav-builder.ts** - Constructs navigation trees from compiled content
- **index.ts** - Exports all utilities for use in compile-content.ts

## Key Patterns

- All utilities are pure functions with no side effects
- Input validation happens at script level, not in utilities
- Markdown processing assumes gray-matter has already extracted frontmatter
- Slugs must be globally unique within content type
- Cross-references use double-bracket syntax: `[[slug]]`

## Integration Points

- Used exclusively by `scripts/compile-content.ts`
- Output feeds into `src/lib/content.ts` for runtime loading
- Markdown sources in `heart_rush/` → JSON output in `content/` (gitignored)

## Development

When modifying utilities:
1. Update types in function signatures
2. Add tests if logic is complex
3. Ensure output format matches what compile-content.ts expects
4. Run `pnpm run compile-content` to validate end-to-end
