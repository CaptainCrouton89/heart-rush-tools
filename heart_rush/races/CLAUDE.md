# Races Directory - CLAUDE.md

This directory contains individual race/culture files for the Heart Rush TTRPG. Each race file is automatically compiled into the combined `Kin_&_Culture.md` section during the build process.

## File Structure

Each race file follows this format:

```markdown
## [Race Name]
[2-3 paragraphs of flavor text, cultural description, and setting information]

### Vitals
- **Size:** [Small/Medium/Large]
- **Height:** [height range]
- **Weight:** [weight range]

### [Subrace/Culture Name]
[1-2 paragraphs describing this subrace's culture and philosophy]

#### Aspects
- **[Aspect Name]:** [Mechanical description]
- **[Aspect Name]:** [Mechanical description]
- (typically 3-5 aspects per subrace)

#### [Ability Name]
**[Passive|Major|Minor] ability.**
[Clear mechanical description and any numerical impacts]

#### [Additional Ability Names]
**[Passive|Major|Minor] ability.**
[Clear mechanical description]
```

## Key Guidelines

### Content Standards
- **Flavor first:** Cultural descriptions should be evocative and support the game world
- **One race per file:** Each file contains one primary race with its subraces/cultures
- **Multiple subraces:** Most races have 2-4 subraces, each with distinct aspects and abilities
- **Aspects format:** Short, punchy mechanical benefits listed with colons
- **Ability mechanics:** Clear, quantifiable effects (e.g., "+2 to Presence rolls", "once per encounter")

### Formatting Rules
- Main race header uses H2 (`##`)
- Subrace headers use H3 (`###`)
- Vitals and Aspects subsections use H4 (`####`)
- Ability names use H4 for standalone abilities
- Bold the ability type designation: `**Passive ability.**` or `**Major ability.**`
- Use clean markdown lists for Aspects (bullets with colons)

### Compilation Behavior
- All race files are automatically combined into `Kin_&_Culture.md` in `all_sections_formatted/`
- File names should match race names (e.g., `Elf.md`, `Dwarf.md`)
- The compilation script maintains alphabetical ordering in the combined file
- Each ability is extracted and indexed separately for search functionality

### Images
- Store race-related images in the `images/` subdirectory
- Reference images using relative paths: `![Description](./images/filename.png)`
- Images are copied to `public/heart_rush/races/` during build

## Common Patterns

### Ability Type Guidelines
- **Passive:** Always active, no action required to use (e.g., "gain advantage on climbing checks")
- **Major:** Significant action cost or usage frequency (e.g., "once per combat encounter")
- **Minor:** Limited impact or Rush Point cost (e.g., "+1 to a specific roll")

### Mechanical Descriptions
Avoid vague language. Use:
- ✓ "gain +2 to Agility rolls"
- ✗ "better at moving"

### Cross-References
When referencing other game systems or rules:
- Use markdown links with descriptive text: `[Combat System](#combat)`
- Reference other races/cultures: `[Dwarven](#dwarven)` (within same file)

## Testing Changes

From parent project:
- `pnpm run compile-content` - Compile races into combined file
- `pnpm run content:watch` - Auto-compile on file changes
- `pnpm run dev` - Start dev server to verify appearance

