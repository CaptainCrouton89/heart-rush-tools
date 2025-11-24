# Combat Talents Directory

This directory contains combat-focused talents for Heart Rush characters. These are martial and tactical abilities that enhance character performance in combat encounters.

## File Organization

Each file represents a single combat talent following the standard talent format documented in `heart_rush/CLAUDE.md`.

## Combat Talent Patterns

### Ability Type Designation

Combat talents use these designations:

- **Passive ability** - Always active combat enhancement (e.g., bonus to attack rolls, damage reduction, improved stance effectiveness)
- **Major ability** - Significant action required to activate, high power level (e.g., special attack maneuvers, defensive reactions)
- **Minor ability** - Limited usage or Rush Point cost (e.g., quick tactical adjustments, temporary bonuses)

### Stance Integration

Many combat talents interact with the four stances:

- **Might Stance** - Offensive power and damage
- **Agility Stance** - Speed, mobility, and dodging
- **Cunning Stance** - Tactical advantage and positioning
- **Defensive Stance** - Protection and mitigation

Reference stance mechanics when talents modify or enhance stance effectiveness.

### Destiny Level Mechanics

Combat talents with Destiny Level upgrades typically:

- Increase damage output or effectiveness
- Expand usage range or frequency
- Add secondary effects or tactical options
- Reduce costs or activation requirements

Include both base and Destiny Level versions in the talent file.

### Common Combat Mechanics

When describing combat talents, use these consistent terms:

- **Heart Die shrink** - Reducing Heart Die size to mitigate damage
- **Rush Points** - Resource for ability activation
- **Challenge Number (CN)** - Target difficulty for opposed rolls
- **Simultaneous action** - Heart Rush uses simultaneous combat, not turn order
- **Engagement** - Active combat participation

## Compilation Notes

All combat talent files in this directory are automatically combined by the build system into the compiled `Talents.md` file. File names are converted to standardized slugs for web navigation.

Maintain consistent file naming (use underscores for spaces, proper capitalization) to ensure predictable slug generation.
