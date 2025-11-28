# Middle Sea - Regional Guidelines

The Middle Sea is Clueanda's central maritime hub, containing interconnected coastal nations, trading powers, and strategic waterways. This directory consolidates these related entities within a cohesive geographic region.

## Core Principle: Maritime & Political Integration

Content in this directory focuses on nations and settlements directly tied to the Middle Sea's economy, politics, and geography. Each file represents a major nation/settlement with its own history and cultural identity, but should reference the broader Middle Sea context.

## Files in This Directory

Each file represents a distinct nation or major settlement:

- **_intro.md** - Overview of the Middle Sea region, major trade routes, strategic importance, and inter-nation relationships
- **Azawahasi.md** - Trading nation/settlement
- **Azuros.md** - Maritime power
- **Eidlsandres.md** - Coastal nation
- **Erpeus.md** - Significant settlement
- **Jinxz Plains.md** - Geographic/political region
- **Lier.md** - Nation/settlement
- **Mkinti.md** - Trading or maritime power
- **Morgnor's Cradle.md** - Mountain domain of a dragon (exception—not maritime-focused)
- **Myastor.md** - Major nation
- **Phii.md** - Coastal settlement
- **Shiverplains.md** - Geographic region
- **Tykos.md** - Nation/settlement

## Content Guidelines

### Within Each Nation File

Each nation file should include:
- **Overview** - Geographic location, cultural identity, and political status
- **History** - Formation, key events, relations with other Middle Sea powers
- **Government** - Political structure and current leadership (link to dramatis_personae for rulers)
- **Economy** - Trade networks, resources, maritime activity (reference nations_and_powers/states for detailed state info)
- **Culture** - Customs, religion, notable characteristics
- **Points of Interest** - Cities, landmarks, important locations within the nation (as subsections)

### Cross-Reference Standards

Link extensively to:
- **nations_and_powers/states/** - For detailed state governance, military, factions (many nations have corresponding state files)
- **dramatis_personae/** - For rulers, merchants, notable NPCs
- **_intro.md** - For regional context and inter-nation relationships
- Other Middle Sea nations for trade partners, rivals, allies

### Avoid Duplication

- Don't duplicate detailed state information—link to `nations_and_powers/states/[Nation].md` instead
- Don't list NPCs inline—use links to `dramatis_personae/` entries
- Don't create new files for POIs—add them as subsections to their parent nation file

## Cross-Continental References

The Middle Sea connects to other regions:
- **Northern territories** - Links to `northlands/` and `celedrim_plains/`
- **Southern trade routes** - References to distant continents (Upoceax, Rimihuica)
- **Island nations** - Connections to `western_isles/`, `northern_isles/`, `free_isles/`
- **Underrealms access** - Some nations may access underground routes

## Development Notes

- Run `pnpm run content:watch` for live recompilation while editing
- Update cross-references if nation relationships or political structures change
- Keep _intro.md as the authoritative source for regional trade networks and inter-nation dynamics
- Geographic subsections (mountains, plains within a nation) stay within that nation's file

