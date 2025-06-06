# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Heart Rush Digital Rulebook is a Next.js 15+ web application that transforms large TTRPG rulebook markdown files into a searchable, wiki-style interface. The application features a content compilation system that processes source markdown files from `heart_rush/` into smaller, navigable JSON sections.

## Development Commands

```bash
# Development
pnpm dev                    # Start dev server with content compilation on port 3909
pnpm compile-content        # Process markdown files into JSON sections
pnpm content:watch          # Watch heart_rush/ for changes and recompile

# Build & Deploy
pnpm build                  # Compile content then build for production
pnpm start                  # Start production server
pnpm lint                   # Run ESLint

# Content Management
tsx scripts/compile-content.ts  # Direct compilation script execution
```

## Architecture Overview

### Content Pipeline

1. **Source Files**: `heart_rush/all_sections_formatted/` contains markdown files with frontmatter
2. **Compilation**: `scripts/compile-content.ts` processes markdown into JSON sections
3. **Output**: `content/` directory contains individual section files, navigation tree, and search index
4. **Runtime**: Next.js App Router serves content with client-side search via Fuse.js

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components organized by function (layout, content, search, ui)
- `src/lib/` - Utility functions for content loading and processing
- `src/types/` - TypeScript type definitions
- `content/` - Generated JSON files (gitignored, created by compilation)
- `scripts/` - Content processing and utility scripts

### Data Flow

Content follows this pattern: Source MD → Compilation → JSON Storage → Runtime Loading → Component Rendering

## Content System

### Source File Format

Source files in `heart_rush/all_sections_formatted/` use frontmatter and are automatically processed into smaller sections based on headers (H1-H3).

### Generated Content Structure

- Each section becomes a JSON file in `content/` with metadata (slug, title, category, tags, cross-references, reading time)
- Navigation tree built automatically based on header hierarchy
- Cross-references extracted from content for internal linking
- Search index generated for Fuse.js

### Content Loading

Use functions from `src/lib/content.ts`:

- `getContentBySlug()` - Load individual sections
- `getAllContentMetadata()` - Get lightweight metadata for listings
- `getNavigationTree()` - Get hierarchical navigation structure
- `getBreadcrumbs()` - Get breadcrumb trail for current page

## Component Architecture

### Layout Components

- `AppLayout` - Root layout with sidebar and main content area
- `Sidebar` - Navigation tree with collapsible sections
- `MainContent` - Content rendering area with table of contents
- `ThemeProvider` - Dark/light theme context with system preference detection

### Content Components

- `MarkdownRenderer` - Renders JSON content with cross-reference linking
- `CrossReferenceLink` - Handles internal links between sections
- `Breadcrumbs` - Shows navigation path
- `TableOfContents` - Auto-generated from content headers

### Search Components

- `SearchInput` - Debounced search with keyboard shortcuts (Cmd/Ctrl+K)
- Search uses Fuse.js for fuzzy matching with weighted results

## TypeScript Standards

### Key Types

- `ContentSection` - Full content with metadata
- `ContentMetadata` - Lightweight version for listings
- `NavigationNode` - Hierarchical navigation structure
- `SearchResult` - Search results with scoring and highlights

### Development Rules

- Keep scripts organized among subfolders within the /scripts folder
- Don't use the "any" type
- Strict TypeScript mode enabled
- All components must be properly typed
- Do not test by running the application—it is already running
- Use interfaces from `src/types/content.ts`
- After each task in task master, clear your own memory except for a few words about what you just did, and the next task.

## Routing Structure

```
/                           # Homepage with content overview
/[slug]                     # Individual content pages (flat routing)
/api/navigation             # Navigation tree API
/api/breadcrumbs/[slug]     # Breadcrumb data API
```

Note: Uses flat routing with single `[slug]` parameter. All content is accessible at root level regardless of hierarchy.

## Search Implementation

Search is client-side using Fuse.js with:

- Weighted scoring (title: 3x, content: 2x, tags: 1x)
- Fuzzy matching with configurable threshold
- Real-time filtering by category and tags
- Debounced input (300ms) for performance
- Results include highlighted matches and snippets

## Performance Considerations

- Content caching in production via Map-based cache in `content.ts`
- Static generation for all routes at build time
- Lightweight metadata loading for listings and navigation
- Progressive loading of full content only when needed
- Search index pre-generated at build time

## Content Development Workflow

1. Edit source files in `heart_rush/all_sections_formatted/`
2. Run `pnpm content:watch` during development for auto-recompilation
3. Source files are automatically split into sections based on headers
4. Cross-references and tags extracted automatically
5. Navigation tree and search index regenerated on each compilation

## Important Patterns

- All content operations are async and handle errors gracefully
- Use caching functions from `content.ts` to avoid repeated file reads
- Follow existing component patterns for consistency
- Cross-references use slug-based linking for internal navigation
- Theme state persists across sessions via localStorage
