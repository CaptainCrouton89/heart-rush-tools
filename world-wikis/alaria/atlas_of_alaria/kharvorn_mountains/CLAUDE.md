# Kharvorn Mountains - Regional Guide

Major mountain range in central Clueanda containing diverse peaks, valleys, and underground systems.

## Content Organization

This region consolidates geographic and landmark content into regional files with subsections:

- **Skywatch.md** - Northern observation posts and strategic peaks
- **Argysis.md** - Eastern mountain territories
- **Aqueandrekons.md** - Central aquatic/underground features
- **Gymlstik.md** - Western territories and settlements
- **Nyinsylys.md** - Dragon lairs and draconic locations
- **Hephake.md** - Southern foothills and transitions
- **Breidleheis.md** - Additional settlements or regions (as needed)
- **Eg\u00fcl Mountains.md**, **Ng\u00fcl Mountains.md**, **Sorg\u00fcl Mountains.md** - Named sub-ranges with H3 subsections for major locations

## Conventions

1. **No standalone POI files** - Dungeons, landmarks, and minor locations belong as H4 subsections within regional files
2. **Named peaks are subsections** - Mountain ranges like Egül, Ngül, Sorgül contain H3 subsections for major features
3. **Cross-references** - Link to bestiary entries for creatures and nations_and_powers for states/factions in the region
4. **File size** - Target ~500 lines per file; split only if exceeding significantly

## Related Content

- **Creatures**: Check `bestiary/dragons/` for draconic entries (Nyinsylys dragon, etc.)
- **Nations**: Link to `nations_and_powers/states/` for Kharvorn-based polities
- **Underground**: Deep features may reference `underrealms/` or `zylogmus_eternus/`

## Development Notes

- Run `pnpm run content:watch` for live recompilation during editing
- Maintain heading hierarchy: H2 (region), H3 (major locations/sub-ranges), H4 (specific POIs/landmarks)
