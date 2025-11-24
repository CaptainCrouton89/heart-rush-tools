# CLAUDE.md - Spells Directory

This directory contains spell talent files for the Heart Rush TTRPG. Spells are a specialized type of talent that require elemental attunement and follow specific formatting conventions.

## Spell File Format

Each spell file should follow this structure:

```markdown
## Spell Name

_[Ability Type] ability. Cognitive talent. Elemental attunement: [Element]._

[Flavor text and mechanical description]

**Destiny Level:**
[Enhanced version mechanics and effects]
```

### Required Metadata

Every spell file must include:

1. **Header (H2):** Spell name matching the filename
2. **Ability Type:** Passive, Major, Minor, or Heart
3. **Talent Category:** Always "Cognitive talent" for spells (not Martial)
4. **Elemental Attunement:** One of nine elements
   - Fire, Water, Air, Earth, Light, Dark, Force, Void, Time
5. **Destiny Level:** Enhanced mechanics for upgraded versions

### Elemental Attunement System

Spells are tied to one of nine elemental systems in Heart Rush. When creating or modifying spells:

- **Fire:** Offensive, damage-focused magic
- **Water:** Healing, fluid, adaptive magic
- **Air:** Speed, evasion, movement-focused
- **Earth:** Defense, stability, grounding effects
- **Light:** Healing, protection, revelation
- **Dark:** Stealth, shadow, deception
- **Force:** Movement, positioning, impact
- **Void:** Negation, null-space, disruption
- **Time:** Duration, preparation, temporal effects

## Compilation Behavior

Spell files from this directory are combined with other talent files into a single `Talents.md` file during compilation. The compilation script:

1. Combines all files from `talents/combat_talents/`, `talents/noncombat_talents/`, and `talents/spells/`
2. Preserves the markdown structure and hierarchy
3. Generates slugs based on spell names
4. Extracts metadata (ability type, attunement) for indexing

All spell files are automatically included in the compiled output—no manual configuration needed.

## Writing Guidelines

### Mechanics Description

- Be clear about what the spell does mechanically
- Include Challenge Numbers if the spell requires a roll
- Specify any resource costs (Rush Points, Heart Die shrinkage, etc.)
- Describe range, area of effect, and duration
- Explain interaction with other game mechanics (stances, attunement conversion, etc.)

### Destiny Level Enhancements

The enhanced version should:
- Increase potency or scope of the base spell
- Add new mechanical options or flexibility
- Enhance range, duration, or area of effect
- Preserve the core theme while expanding capability

### Consistency Notes

- Match formatting with existing spell files in this directory
- Use consistent ability type designations
- Maintain consistent language for similar mechanical concepts
- Cross-reference other talents/spells when relevant using markdown links

## Testing Content

After creating or modifying spells:

1. From parent project: `pnpm run compile-content` to verify compilation
2. Check that spell appears in generated content with correct metadata
3. Verify elemental attunement is properly captured
4. Ensure markdown formatting doesn't break compilation
