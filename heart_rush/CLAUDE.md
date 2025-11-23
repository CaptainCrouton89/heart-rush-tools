# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This directory contains the source markdown files for the Heart Rush TTRPG rulebook. These are the canonical source files that define the game's rules, mechanics, and content.

## Critical Constraints

### Edit Individual Files, NOT Compiled Files

**NEVER edit files in `all_sections_formatted/` directly.** These are compilation targets:

- Individual talent/spell/race files compile into master files in `all_sections_formatted/`
- When adding/editing talents, spells, or races, edit individual files in their respective directories
- The compilation process (handled by the web app build) merges individual files into master documents

### File Naming Conventions

File naming MUST follow these patterns or compilation will break:

- **Talents** (combat/noncombat): `Pascal_Case_With_Underscores.md` (e.g., `Shield_Mastery.md`, `Battle_Frenzy.md`)
- **Spells**: `lowercase-with-hyphens.md` (e.g., `blizzard.md`, `flame-bolt.md`)
- **Races**: `Pascal_Case_With_Underscores.md` (e.g., `Dwarf.md`, `Elf.md`)

### Header Structure Requirements

Individual files MUST use `## Name` (h2 header) for the main entity:

```markdown
## Shield Mastery

_Passive ability. Martial talent._

Your shields are an extension of your combat awareness...
```

**Why this matters:** During compilation:
- Talent/spell files merge into `all_sections_formatted/Talents.md` (names become `### Name`)
- Race files merge into `all_sections_formatted/Kin_&_Culture.md` (names stay `## Name`)

Sub-sections within individual files use `###` (h3), `####` (h4), etc.

## Directory Structure

### Compilation Architecture

```
races/*.md → all_sections_formatted/Kin_&_Culture.md
talents/combat_talents/*.md → all_sections_formatted/Talents.md
talents/noncombat_talents/*.md → all_sections_formatted/Talents.md
talents/spells/*.md → all_sections_formatted/Talents.md
```

### Core Content Directories

- **all_sections_formatted/** - Compiled master files for each major rulebook section
  - **DO NOT EDIT THESE FILES DIRECTLY**
  - Kin_&_Culture.md is compiled from races/*.md
  - Talents.md is compiled from talents/\*\*/\*.md
  - Other sections (Combat.md, Bloodmarks.md, etc.) are standalone and CAN be edited

- **races/** - Individual race/kin files (54 files)
  - Each file defines one playable race with aspects, racial abilities, and heritage options
  - Edit these to add/modify races

- **talents/** - Individual talent and spell files
  - combat_talents/ - Combat-focused abilities (97 files)
  - noncombat_talents/ - Utility and social abilities (80 files)
  - spells/ - Elemental magic spells (67 files, lowercase-with-hyphens naming)
  - Edit these to add/modify talents/spells

- **gm_guide/** - Game Master specific content and guidance

- **archive/** - Deprecated content NO LONGER part of the active rulebook
  - Classes_Legacy.md - Old class-based system (**replaced by Bloodmarks**)
  - Influence.md, spelltouched.md - Other archived systems
  - **DO NOT reference or edit archived content**

## Content Formatting Patterns

### Ability Tags

Tags appear in italics immediately after the ability name, separated by periods:

```markdown
_Passive ability. Martial talent._
_Major ability. Handmagic._
_Monthly ability. Air and Ice. Ongoing._
```

### Ability Structure

```markdown
## Ability Name

_Tags go here._

Description of what the ability does...

**Destiny Level:**
Enhanced version description...
```

### Race Structure

```markdown
## Race Name

Brief cultural/physical description.

### Vitals

- **Size:** Medium
- **Height:** X-Y feet
- **Weight:** X-Y pounds

### Racial Ability Name

**Passive ability.**
Description of what it does...

### Heritage Name (Optional Flavor)

Cultural description and lore.

#### Aspects

- First aspect description
- Second aspect description

#### Heritage Ability

**Passive ability.**
Ability description...
```

### Common Formatting Elements

- **Ability names in text**: `**Name**` (bold)
- **Passive markers**: `**Passive ability.**` on its own line
- **Sections**: Double line breaks between major sections
- **Lists**: Bullet points with `-` for aspects, vitals, and option lists
