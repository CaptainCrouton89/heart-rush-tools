# Northern Isles - Regional Context

The northern_isles/ directory contains geographic and cultural content for the far northern Arctic archipelago, a region of extreme climate, isolated communities, and unique cultures shaped by isolation and magical dominion.

## Regional Characteristics

- **Climate**: Frozen tundra, pack ice, treacherous straits; only volcanic areas provide natural warmth
- **Inhabitants**: Hardened seafaring cultures, exiles, outcasts, and those drawn to extreme environments
- **Geography**: Fragmented archipelago with major islands (Pherezi Imnuttut, Aknimchuk, Potalaptuk) and numerous smaller ones
- **Power Structure**: No unified government; dominated by Bzulakar's magical supremacy and localized authorities

## File Organization

- **_intro.md** - Regional overview, geography, major islands, political climate, and notable locations framework
- **Aknimchuk.md** - Northwestern volcanic island with Ashy Mountains and Scheyolonae tundra
- Additional .md files for other major locations as content warrants

## Key Content Patterns

### Location Hierarchy
- Major islands get dedicated files when content exceeds ~200 lines
- Sub-locations (geographic features, settlements, dungeons) are H3/H4 subsections within parent files
- Example: Aknimchuk contains Ashy Mountains, Tomb of Angi, Scheyolonae, Iceburn Lakes, Salamander Cave, and Smokey Bay as nested subsections

### Cross-References
When referencing Northern Isles content:
- **dramatis_personae/** for rulers and powerful beings (Bzulakar, Gelnor)
- **bestiary/** for unique creatures (ice salamanders, giants, fire elementals)
- **nations_and_powers/states/** for political entities or settlements with governance

## Content Development Notes

- Volcanic regions (Aknimchuk, Blizrynthine) support unique life and provide narrative contrast to the frozen wastes
- Bzulakar's influence radiates from central Potalaptuk, shaping political reality across the archipelago
- The Timeless Wastes, Hills of Insanity, and other anomalies offer adventure hooks and environmental hazards
- Run `pnpm run content:watch` for live recompilation while editing
- Maintain consistent heading hierarchy: H2 for regions, H3 for major features/settlements, H4 for POIs
