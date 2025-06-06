# Heart Rush Digital Rulebook - Product Requirements Document

## Project Overview

Create a searchable, wiki-style web application for the Heart Rush TTRPG rulebook using Next.js 14+ and TypeScript. The app will feature a content compilation system that transforms large source markdown files into smaller, navigable sections optimized for web consumption.

## Technical Architecture

### Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Search**: Fuse.js for client-side fuzzy search
- **Markdown**: `next-mdx-remote` for dynamic markdown rendering
- **Content Processing**: Custom compilation script using `gray-matter`
- **Icons**: Lucide React
- **State Management**: React Context for theme/search state
- **Deployment**: Vercel

### Project Structure

```
heart-rush-tools/
├── heart_rush/                    # Your existing source content
│   ├── all_sections/             # Individual source markdown files
│   ├── all_sections_formatted/   # Formatted source files
│   ├── master.md                 # Combined source file
│   └── ToC.md                    # Table of contents
├── content/                      # Generated smaller files (add to .gitignore)
│   ├── basic-needs/
│   ├── combat/
│   ├── classes/
│   ├── equipment/
│   └── ...
├── scripts/
│   └── compile-content.ts        # Content compilation script
├── src/
│   ├── app/                      # Next.js app router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── [category]/
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   └── search/
│   │       └── page.tsx
│   ├── components/               # React components
│   │   ├── layout/
│   │   ├── content/
│   │   ├── search/
│   │   └── ui/
│   ├── lib/                      # Utilities and configurations
│   │   ├── content.ts
│   │   ├── search.ts
│   │   └── utils.ts
│   └── types/                    # TypeScript type definitions
│       └── content.ts
├── public/                       # Static assets
├── .gitignore                    # Add content/ directory
├── next.config.ts
├── package.json
├── PRD.md                        # Your existing PRD
├── README.md
└── tsconfig.json
```

## Content Management System

### Content Compilation Process

**Source File Format:**

```yaml
---
category: "combat"
order: 4
tags: ["mechanics", "engagement", "damage"]
description: "Core combat mechanics and rules"
---
# Combat

Content here with multiple ## and ### sections...
```

**Compilation Script Requirements:**

- Parse large markdown files from `content-source/`
- Split on headers (H1, H2, H3) into individual sections
- Generate metadata for each section including parent relationships
- Extract cross-references automatically from content
- Output structured smaller files to `content/` directory
- Preserve original markdown formatting and tables

**Generated File Structure:**

```
content/
├── combat/
│   ├── engaging-the-enemy.md
│   ├── taking-damage.md
│   ├── wounds.md
│   └── special-circumstances.md
├── classes/
│   ├── strongheart.md
│   ├── battleheart.md
│   └── cleverheart.md
```

**Generated Frontmatter Schema:**

```yaml
---
title: "Taking Damage"
category: "combat"
level: 2 # Header level (1-6)
parent: "combat" # Parent section slug
order: 3 # Order within category
tags: ["damage", "wounds", "hit-points"]
cross_refs: ["wounds", "heart-die", "conditions"]
word_count: 450
reading_time: 2 # Minutes
---
```

### Build Integration

```json
{
  "scripts": {
    "compile-content": "tsx scripts/compile-content.ts",
    "build": "npm run compile-content && next build",
    "dev": "npm run compile-content && next dev",
    "content:watch": "nodemon --watch content-source --ext md --exec 'npm run compile-content'"
  }
}
```

## Feature Specifications

### Core Navigation

- **Sidebar Navigation Tree**: Hierarchical structure matching content organization
  - Collapsible categories
  - Visual indicators for current page
  - Search within navigation
- **Breadcrumb Navigation**: Show current location path
- **Table of Contents**: Auto-generated from H2-H6 headers within current page
- **Previous/Next Navigation**: Navigate sequentially through content

### Search Functionality

- **Global Search Bar**:
  - Instant search with debounced input (300ms)
  - Search across titles, content, tags
  - Keyboard shortcut (Cmd/Ctrl + K)
- **Search Results**:
  - Weighted results (title: 3x, headers: 2x, content: 1x)
  - Content snippet preview with highlighted matches
  - Category and tag filters
  - Recent searches persistence
- **Advanced Filtering**:
  - Filter by category
  - Filter by tags
  - Filter by content type (rules, spells, equipment, etc.)

### Content Display

- **Markdown Rendering**:
  - Tables with responsive overflow
  - Code blocks with syntax highlighting
  - Custom components for game-specific elements (stat blocks, etc.)
- **Cross-Reference Links**: Automatic linking between related sections
- **Reading Progress**: Visual progress indicator
- **Print Styles**: Clean printing layout

### User Experience

- **Theme Toggle**: Dark/light mode with system preference detection
- **Responsive Design**: Mobile-first approach with collapsible sidebar
- **Loading States**: Skeleton screens and progressive loading
- **Error Boundaries**: Graceful error handling with fallback content
- **Accessibility**: WCAG 2.1 AA compliance

## Component Architecture

### Core Components

```typescript
// Layout Components
<RootLayout />              // Theme provider, global styles
<Sidebar />                 // Navigation tree
<MainContent />             // Content area with TOC
<SearchDialog />            // Global search modal

// Content Components
<MarkdownRenderer />        // MDX rendering with custom components
<TableOfContents />         // Page navigation
<Breadcrumbs />             // Navigation path
<CrossReferenceLink />      // Internal linking

// UI Components
<SearchInput />             // Debounced search
<FilterChips />             // Category/tag filters
<ThemeToggle />             // Dark/light mode
<ProgressBar />             // Reading progress
```

### Data Flow

```typescript
// Content loading
const content = await getContentBySlug(slug);
const searchIndex = await getSearchIndex();
const navigation = await getNavigationTree();

// Search state management
const SearchContext = createContext({
  query: string,
  results: SearchResult[],
  filters: FilterState,
  isOpen: boolean
});
```

## Type Definitions

```typescript
interface ContentSection {
  slug: string;
  title: string;
  category: string;
  level: number;
  parent?: string;
  content: string;
  tags: string[];
  cross_refs: string[];
  word_count: number;
  reading_time: number;
  order: number;
}

interface NavigationNode {
  slug: string;
  title: string;
  children: NavigationNode[];
  category: string;
  order: number;
}

interface SearchResult {
  slug: string;
  title: string;
  category: string;
  snippet: string;
  matches: SearchMatch[];
  score: number;
}

interface SearchMatch {
  field: "title" | "content" | "tags";
  value: string;
  indices: [number, number][];
}
```

## Implementation Requirements

### Content Compilation Script

```typescript
// scripts/compile-content.ts
- Parse frontmatter and markdown content
- Split on headers (configurable depth)
- Generate slugs with conflict resolution
- Extract cross-references using regex patterns
- Calculate reading time and word count
- Preserve markdown tables and formatting
- Handle special Heart Rush game elements
- Generate navigation tree structure
- Create search index data
```

### Search Implementation

```typescript
// lib/search.ts
- Index all content at build time
- Fuse.js configuration for fuzzy matching
- Weighted search across multiple fields
- Result highlighting and snippet generation
- Category and tag filtering
- Search history management
```

### Routing Structure

```
/                           # Homepage with overview
/[category]/[slug]          # Individual content pages
/search                     # Dedicated search page
/search?q=combat            # Search with query
```

### SEO Requirements

- Dynamic meta tags for each content page
- Structured data for game rules content
- XML sitemap generation
- Open Graph tags for social sharing

## Success Criteria

### Functional Requirements

- ✅ All source content successfully compiled into navigable sections
- ✅ Search functionality finds relevant content with < 200ms response time
- ✅ Navigation tree accurately reflects content hierarchy
- ✅ Cross-references automatically link to correct sections
- ✅ Mobile experience fully functional on devices > 375px width
- ✅ Dark/light theme persists across sessions

### Content Requirements

- ✅ All source documents successfully processed
- ✅ No markdown formatting lost in compilation
- ✅ Tables remain readable and functional
- ✅ Game-specific terminology properly linked
- ✅ Reading time estimates within 20% accuracy

### Technical Requirements

- ✅ TypeScript strict mode with no errors
- ✅ Build process completes without warnings
- ✅ All pages load within performance budgets
- ✅ Search index builds automatically on content changes
- ✅ Hot reload works in development mode
