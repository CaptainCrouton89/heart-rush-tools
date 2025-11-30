$ARGUMENTS

You are given a screenshot of a fantasy map. Follow the workflow below with strict adherence to approval checkpoints. Use explore-agents immediately to investigate, cross-reference, and clarify all named entities visible on the map. Agents should look for spelling variants, regional context, nearby labels, and any patterns that help confirm names. When names remain unreadable, output a placeholder (`<NAME_UNREADABLE_##>`) and describe its location.

# MAP LEGEND

## Settlement Markers
| Symbol | Meaning |
|--------|----------|
| ⊛ | City-state |
| ★ | Capital |
| ■ | City |
| ▲ | Town |
| ● | Village |
| ✕ | Point of Interest |
| ⌂ | Fortress |

## Lines & Routes
| Style | Meaning |
|-------|----------|
| Solid brown/red | Border |
| Solid cyan | River |
| Dotted cyan | Seasonal River |
| Solid red | Road |
| Dotted grey | Trail |
| ✕✕✕✕ | Tunnel |
| Dotted blue | Trade Route |

## Special Markers
| Symbol | Meaning |
|--------|----------|
| Red dot | Settled area |
| Purple dot | Ruins |
| Dragon head | Dragon location |
| Arrow | Astral current |
| Long colored lines | Elemental leyline |

**Scale:** 1 hex = 5 miles

# WORKFLOW

## 1. Initial Exploration (High-Level Research)
- Use explore-agents immediately to:
  - Identify named regions, states, landmarks, and features.
  - Check variant spellings or partially legible labels.
  - Cross-reference context (nearby terrain, settlements, borders) to clarify naming.
  - Trust *existing lore names* when visible or previously established.
  - If unreadable, output `<NAME_UNREADABLE_##>`.

- Examine the image as a whole and identify:
  - Major biomes and geographic zones (mountains, forests, plains, coasts, deserts, etc.)
  - Large political regions or states visible in the screenshot
  - Macroscale features (mountain chains, major rivers, forests, coastlines, borders)
  - Any capitals, city-states, or cities (always list these if visible)

- Describe overall geographic layout using cardinal directions.
- Note settlement density and distribution logic.

- **Spatial Accuracy Check:**  
  - Compare what the map shows against any existing written worldbuilding.  
  - Identify inconsistencies in spatial relationships (distances, adjacency, borders, coast shapes, river paths, regional placement).  
  - Propose precise corrections based solely on the map image.  
  - When lore names conflict with map geography:  
    - Keep established names.  
    - Correct their spatial descriptions to match the image.

**Stop and await approval before continuing.**

## 2. Zoom-In Stages (Subregions)
When further, more zoomed-in images are provided:
- Use explore-agents to verify local naming, detect spatial contradictions, and reaffirm relationships to the broader region.
- Describe detailed terrain, geography, and settlement clusters.
- When many villages/towns appear, note density and patterns.
- When few appear, list each explicitly by marker type and approximate location.
- Continue identifying spatial inconsistencies and propose corrections grounded only in the images.

**Stop and await approval before continuing.**

## 3. Synthesis & Lore Expansion
After sufficient exploration:
- Propose improvements and opportunities for richer worldbuilding.
- Focus on:
  - Regional geography logic
  - State borders and political dynamics
  - Trade routes, chokepoints, natural defenses, cultural divides, economic structure
- For broad/open-ended questions, provide bulleted options.
- Ensure all spatial details reflect the images; preserve existing names unless directed otherwise.

# CONSTRAINTS
- Do not invent names unless explicitly asked; use placeholders for unreadable text.
- Do not extrapolate beyond what the map displays unless explicitly requested.
- Maintain precise and concise language.
- Always identify visible capitals, city-states, and cities.
- Note special markers (seasonal rivers, leylines, astral currents, ruins, etc.).
- Assume multiple images belong to a continuous region; stitch features across images whenever possible.
- Trust established names from lore, but trust the images for spatial accuracy and make corrections accordingly.