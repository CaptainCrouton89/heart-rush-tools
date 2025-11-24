# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Content Directory Overview

This directory (`heart_rush/`) contains the source markdown files for the Heart Rush TTRPG rulebook. These files are compiled by the parent project's build system (`scripts/compile-content.ts`) into structured JSON for the digital rulebook web application.

## Directory Structure

### Main Content Areas

- `all_sections_formatted/` - Core rulebook sections (31 files) including character creation, combat, magic systems, equipment, and advancement
- `races/` - Individual race files (54 files) - each race/culture gets its own markdown file with vitals, aspects, and passive abilities
- `talents/` - Character abilities organized into three subdirectories (246 total files):
  - `combat_talents/` - Martial and combat-focused talents
  - `noncombat_talents/` - Utility and non-combat abilities
  - `spells/` - Elemental magic spells requiring attunement
- `gm_guide/` - GM-specific content including monster creation, pacing guides, travel guides, and event tables

### Supporting Files

- `Heart_Rush_Player_Guide.md` - Comprehensive overview of the game system and design philosophy
- `ToC.md` - Table of contents reference

## Content Architecture

### File Format Standards

All content files follow consistent markdown patterns:

**Race Files:**
```markdown
## Race Name
[Flavor text and cultural description]

### Vitals
- Size, Height, Weight

### [Subrace Name]
[Cultural description]

#### Aspects
- List of cultural aspects

#### [Ability Name]
**[Passive|Major|Minor] ability.**
Ability description and mechanics
```

**Talent Files:**
```markdown
## Talent Name

_[Passive|Major|Minor] ability. [Martial|Cognitive] talent. [Elemental attunement if applicable]_

Talent description and mechanics.

**Destiny Level:**
Enhanced version mechanics.
```

**Rulebook Sections:**
- Use clear hierarchical headers (H2 for major sections, H3 for subsections)
- Self-contained sections that can be independently navigated
- Cross-references use standard markdown link syntax

### Compilation Process

The parent project's `scripts/compile-content.ts` processes these files:

1. **Race compilation:** All individual race files from `races/` are combined into a single `Kin_&_Culture.md` file
2. **Talent compilation:** All talent files from `talents/combat_talents/`, `talents/noncombat_talents/`, and `talents/spells/` are combined into a single `Talents.md` file
3. **Section processing:** Files from `all_sections_formatted/` are split by headers into individual JSON sections
4. **Metadata generation:** Slugs, tags, cross-references, and navigation trees are generated
5. **Output:** Structured JSON files written to `content/` directory in parent project

### Content Guidelines

- Headers determine navigation structure - keep them clear and hierarchical
- Each talent/race/spell file contains a single entity (one talent per file, one race with subraces per file)
- Maintain consistent formatting for passive/major/minor ability designations
- Use markdown formatting (bold, italic, lists) consistently
- Cross-references should use descriptive link text
- Files in `all_sections_formatted/CLAUDE.md` should NOT be compiled (excluded via compilation script)

## Game System Reference

Heart Rush is a tactical fantasy TTRPG with:

- **Core mechanic:** Heart Die + Ability Die + Modifiers vs Challenge Number
- **Four abilities:** Might, Agility, Cunning, Presence (each uses dice sizes: d4, d6, d8, d10, d12)
- **Heart Die:** Represents stamina/willpower, can be shrunk to mitigate damage
- **Simultaneous combat:** Stance-based engagement system (Might/Agility/Cunning/Defensive)
- **Advancement:** Direct XP spending on talents, stats, HP (no traditional leveling)
- **Bloodmarks:** Earned through legendary feats, grant combat specializations
- **Magic:** Elemental attunement system with nine elements (Fire, Water, Air, Earth, Light, Dark, Force, Void, Time)

**This game is not D&D. The action economy, dice, and much more are all _different_.**

## Working with Content

### Adding New Races

1. Create new file in `races/[RaceName].md`
2. Follow race file format with Vitals, subraces, Aspects, and abilities
3. Compilation script will automatically include it in combined output

### Adding New Talents

1. Create new file in appropriate subdirectory:
   - `talents/combat_talents/` for martial/combat talents
   - `talents/noncombat_talents/` for utility abilities
   - `talents/spells/` for elemental magic requiring attunement
2. Use consistent talent file format with ability type designation
3. Include Destiny Level mechanics if applicable
4. Compilation script will automatically include it

### Modifying Rulebook Sections

1. Edit files in `all_sections_formatted/`
2. Maintain header hierarchy for proper navigation generation
3. Ensure cross-references use valid section names
4. Changes automatically reflected in next compilation

### Testing Changes

From parent project directory:
- `pnpm run compile-content` - Manually trigger compilation
- `pnpm run content:watch` - Watch for changes and auto-recompile
- `pnpm run dev` - Run dev server with automatic compilation

## Common Patterns

### Ability Type Designations

- **Passive ability:** Always active, no action required
- **Major ability:** Requires action to use, significant power level
- **Minor ability:** Costs Rush Points or has limited usage

### Talent Categories

- **Martial talent:** Combat-focused, requires physical action
- **Cognitive talent:** Mental/magical ability
- **Elemental attunement:** Requires specific element connection (Fire, Water, Air, Earth, Light, Dark, Force, Void, Time)

### Cross-Reference Patterns

When referencing other rulebook sections, use descriptive link text:
- `[Combat](#combat)` not just `combat`
- `[Kethic Elementalism](#kethic-elementalism)` for magic system
- Link text should match section header for compilation to resolve correctly
