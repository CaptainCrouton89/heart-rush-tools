# Content Compilation System

## Overview
Automated pipeline that transforms source markdown files from the Heart Rush TTRPG into optimized JSON content for web consumption. Handles content splitting, metadata generation, cross-referencing, and navigation tree building.

## How It Works
1. **Source Processing**: Reads markdown files from `heart_rush/all_sections_formatted/`
2. **Content Aggregation**: Combines race files and talent files into unified sections
3. **Header Splitting**: Breaks large markdown files into smaller sections based on headers (H1-H6)
4. **Metadata Generation**: Extracts frontmatter, calculates reading time, generates slugs, identifies cross-references
5. **JSON Output**: Writes structured JSON files to `content/` directory for Next.js consumption

## Key Files
- **`scripts/compile-content.ts`** - Main compilation script and entry point
- **`scripts/markdown-to-json.ts`** - Core markdown processing utilities
- **`scripts/test-content-utils.ts`** - Testing utilities for content processing
- **`heart_rush/all_sections_formatted/`** - Source markdown files
- **`heart_rush/races/`** - Individual race markdown files
- **`heart_rush/talents/`** - Combat and non-combat talent files
- **`content/`** - Generated JSON output directory (gitignored)

## Content Structure
### Input Format (Markdown)
```markdown
---
category: "combat"
order: 4
tags: ["mechanics", "engagement"]
description: "Core combat mechanics"
---
# Combat
## Engaging the Enemy
Content here...
### Special Circumstances
More content...
```

### Output Format (JSON)
```json
{
  "slug": "engaging-the-enemy",
  "title": "Engaging the Enemy",
  "category": "combat",
  "level": 2,
  "parent": "combat",
  "content": "Content here...",
  "tags": ["mechanics", "engagement"],
  "cross_refs": ["wounds", "conditions"],
  "word_count": 450,
  "reading_time": 2,
  "order": 3
}
```

## Special Processing
- **Race Combination**: 54 individual race files combined into `Kin_&_Culture.md`
- **Talent Aggregation**: 104 combat + 82 non-combat talents combined into `Talents.md`
- **Image Handling**: Race images copied to `public/heart_rush/races/images/`
- **Cross-Reference Detection**: Automatic linking based on content analysis
- **Slug Generation**: URL-safe slugs with conflict resolution

## Build Integration
- **Development**: `npm run dev` triggers compilation before starting server
- **Production**: `npm run build` compiles content before Next.js build
- **Watch Mode**: `npm run content:watch` monitors source files for changes
- **Manual**: `npm run compile-content` runs compilation independently

## Navigation Tree Generation
Creates hierarchical navigation structure with parent-child relationships:
```typescript
interface NavigationItem {
  slug: string;
  title: string;
  level: number;
  parent?: string;
  order: number;
  children?: NavigationItem[];
}
```

## Performance Features
- Content split into smaller, loadable sections
- Metadata pre-calculated during build time
- Navigation trees cached as JSON
- Cross-references resolved at compile time
- Reading time estimation for user experience

## Error Handling
- Validates markdown frontmatter
- Handles missing files gracefully
- Reports compilation statistics
- Logs processing errors with file context
- Continues processing on individual file failures

## Development Notes
- Must run before Next.js dev/build (handled by npm scripts)
- Output files are gitignored and regenerated on each build
- Supports both player and GM content with separate processing pipelines
- Maintains source markdown formatting and table structures