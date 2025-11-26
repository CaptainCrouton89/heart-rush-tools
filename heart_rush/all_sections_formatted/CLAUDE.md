# CLAUDE.md - Rulebook Sections Directory

This directory contains the main rulebook section source files that are compiled into the Heart Rush Digital Rulebook's player content.

## Content Structure

Each markdown file represents a major rulebook section that gets processed by `scripts/compile-content.ts`:

- Files are split by headers (H2, H3) into individual content sections
- Each section becomes a standalone entry with its own slug and metadata
- Headers form the hierarchical navigation tree displayed in the app
- Content within sections supports markdown formatting and cross-references

## File Organization

- One markdown file per major rulebook section
- File names should be descriptive and match the top-level header
- Files are processed in order defined by the compilation script
- Total content should cover all player-facing rulebook material

## Compilation Process

When content is compiled:

1. Files are read and processed by the markdown parser (gray-matter)
2. Content is split by header boundaries
3. Slugs are generated from header text (URL-safe)
4. Metadata is extracted (title, category, tags)
5. Cross-references are identified
6. Output JSON is written to `content/` directory

## Game Balance & Content Guidelines

When adding or modifying rulebook sections, especially those describing abilities and mechanics:

- **Understand the power curve**: Heart Rush is "fail-forward" and gritty—power is earned through advancement
- **Balance frequency and impact**: Reference ability tags (Passive, Minor, Major, Weekly, Monthly) and understand their balance implications
- **Niche protection**: Ensure new mechanics enable specific playstyles without invalidating existing talents or races
- **Resource management**: Abilities should have meaningful costs (Actions, Rush Points, daily uses) reflecting their power level

For detailed guidance on balancing talents, races, bloodmarks, and progression, use the **balance-guide skill** with the `/learn` command or reference:
- `heart_rush/.claude/skills/balance-guide/SKILL.md`

For context on game mechanics and design philosophy:
- `heart_rush/Heart_Rush_Player_Guide.md`

## Related Files

- Compilation script: `scripts/compile-content.ts`
- Output directory: `content/`
- Content utilities: `src/lib/content.ts`
- Theme/styling: `src/components/ContentRenderer.tsx`
