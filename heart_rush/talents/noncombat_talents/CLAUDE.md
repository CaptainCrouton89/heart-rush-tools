# Non-Combat Talents

This directory contains non-combat talent definitions for the Heart Rush TTRPG. These are character abilities used outside of direct combat scenarios.

## File Structure

Each talent is a separate markdown file named `TalentName.md` (using underscores for spaces in filenames).

## Talent Format

Non-combat talents follow this consistent structure:

```markdown
## Talent Name

_[Ability Type]. [Category/Trait Tags]._

[Main ability description with mechanical details, ranges, and constraints.]

**Destiny Level:**
[Upgraded version of the ability at higher character levels.]
```

### Key Components

- **Header**: `## Talent Name` (h2)
- **Metadata Line**: Italic line with: Ability Type (Passive, Weekly, Major, Minor) and Category/Traits (Cognitive talent, Handmagic, Shaman, etc.)
- **Description**: Mechanical rules written in clear prose
- **Destiny Level**: Optional upgraded version available at higher character progression

## Guidelines

- Keep descriptions concise but complete with all mechanical information
- Clearly specify ability activation (passive, weekly frequency, action cost, etc.)
- Use markdown emphasis (_italics_ and **bold**) sparingly for key information
- Destiny Level upgrades should be meaningful mechanical improvements, often broadening scope or increasing potency

## Processing

These files are compiled by `scripts/compile-content.ts` which:
- Combines all talent files into a single `Talents.md` in `heart_rush/all_sections_formatted/`
- Generates JSON content for the web application
- Creates searchable sections with cross-references

## Related Directories

- `../combat_talents/` - Combat-focused abilities
- `../spells/` - Elemental magic requiring attunement
- `../` - Parent talents directory with organization by type
