# Races Directory - CLAUDE.md

This directory contains individual race/culture files for the Heart Rush TTRPG. Each race file is automatically compiled into the combined `Kin_&_Culture.md` section during the build process.

## Understanding Heart Rush Races

Races provide **physical identity, cultural flavor, and mechanical benefits** through passive abilities. In Heart Rush, races don't provide skill bonuses or stat adjustments—instead they provide unique abilities that reflect their cultural heritage and physical nature.

**Core concept:** A gnome's connection to magic isn't represented by better spell rolls; it's represented by cheaper handmagic talents and racial talents that grant free magical abilities.

For comprehensive balance guidance, see `.claude/skills/balance-guide/RACE_BALANCE.md`.

## File Structure

Each race file follows this format:

```markdown
## [Race Name]
[2-3 paragraphs of flavor text, cultural description, and setting information]

### Vitals
- **Size:** [Small/Medium/Large]
- **Height:** [height range]
- **Weight:** [weight range]

### [Race Ability Name]
**[Passive|Major|Minor] ability.**
[Core mechanical description—often affects XP costs or grants a free talent]

### [Subrace/Culture Name]
[1-2 paragraphs describing this subrace's culture and philosophy]

#### Aspects
- [Flavor Aspect Name]
- [Flavor Aspect Name]
(These are personality/cultural themes, not mechanical benefits)

#### [Ability Name]
**[Passive|Major|Minor] ability.**
[Clear mechanical description and any numerical impacts]
```

## Key Guidelines

### Content Standards
- **Flavor first:** Cultural descriptions should be evocative and support the game world
- **One race per file:** Each file contains one primary race with its subraces/cultures
- **Multiple subraces:** Most races have 2-4+ subraces, each with distinct aspects and abilities
- **Aspects are flavor, not mechanics:** Short, punchy personality/cultural themes (e.g., "Creative", "Survivor of the jungle depths", "Fragile as glass")
- **Ability mechanics:** Clear, quantifiable effects with specific numbers or frequency (e.g., "+2 XP cost reduction", "once per encounter", "A2 on survival checks")

### Mechanical Patterns

**Base Race Ability** (often one per race):
- May modify XP costs (e.g., Gnome's "Gnomish Blood" reduces handmagic costs, increases HP costs)
- May grant a free racial talent
- Sets the race's core mechanical identity

**Subrace Abilities** (one per subrace, typically):
- Racial talents that reinforce cultural identity
- Passive benefits reflecting unique adaptations
- Can be free talent grants or special mechanics (e.g., Coastal Camouflage, Sanguine Empowerment)

### Formatting Rules
- Main race header uses H2 (`##`)
- Base race ability comes after Vitals (before subraces)
- Subrace headers use H3 (`###`)
- Aspects subsection uses H4 (`####`) with bullet points
- Ability names use H4 for standalone abilities
- Bold the ability type designation: `**Passive ability.**` or `**Major ability.**`
- Use clean markdown lists for Aspects (bullets with no colons)

### Compilation Behavior
- All race files are automatically combined into `Kin_&_Culture.md` in `all_sections_formatted/`
- File names should match race names (e.g., `Elf.md`, `Dwarf.md`)
- The compilation script maintains alphabetical ordering in the combined file
- Each ability is extracted and indexed separately for search functionality

### Images
- Store race-related images in the `images/` subdirectory
- Reference images using relative paths: `![Description](./images/filename.png)`
- Images are copied to `public/heart_rush/races/` during build

## Balance Principles

**Racial abilities should be roughly equivalent in power** to a talent (~2.5 damage equivalent for combat-related benefits). Common patterns:

- **XP Cost Modifiers:** Cheaper costs for core talents (handmagic, attunement) balanced by more expensive other costs
- **Free Talents:** Provide a signature talent relevant to the race's identity
- **Passive Benefits:** Advantage/Disadvantage on specific checks, movement bonuses, or special senses
- **Size Adjustments:** Small races harder to hit; Large races wield heavy weapons easier
- **Subrace Balance:** Base race gets weaker/broader ability; subraces get more specialized, powerful abilities

For detailed analysis of existing races and balance targets, consult the `RACE_BALANCE.md` skill.

## Testing Changes

From parent project:
- `pnpm run compile-content` - Compile races into combined file
- `pnpm run content:watch` - Auto-compile on file changes
- `pnpm run dev` - Start dev server to verify appearance
