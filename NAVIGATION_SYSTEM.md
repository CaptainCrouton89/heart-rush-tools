# Navigation System

## Overview
Hierarchical navigation system providing multi-level content organization with collapsible sidebar, breadcrumb trails, table of contents, and previous/next navigation. Supports both player and GM content with separate navigation trees.

## How It Works
1. **Navigation Tree**: Built from content metadata during compilation
2. **Hierarchical Structure**: Parent-child relationships based on content headers
3. **Dynamic Breadcrumbs**: Generated from current page location in hierarchy
4. **Table of Contents**: Auto-generated from markdown headers within current page
5. **Sequential Navigation**: Previous/next links within content categories

## Key Files
- **`src/components/layout/NavigationTree.tsx`** - Main navigation sidebar component
- **`src/components/layout/Sidebar.tsx`** - Sidebar container with responsive behavior
- **`src/components/layout/Breadcrumbs.tsx`** - Breadcrumb trail component
- **`src/components/layout/TableOfContents.tsx`** - In-page TOC generation
- **`src/app/api/navigation/route.ts`** - API endpoint for navigation data
- **`src/app/api/breadcrumbs/route.ts`** - API endpoint for breadcrumb generation
- **`navigation-categories.json`** - Category configuration for player content
- **`gm-navigation-categories.json`** - Category configuration for GM content

## Navigation Structure
### Navigation Tree Format
```typescript
interface NavigationItem {
  slug: string;
  title: string;
  level: number;
  parent?: string;
  order: number;
  children?: NavigationItem[];
}

interface NavigationCategory {
  name: string;
  sections: NavigationItem[];
  order: number;
}
```

### Category Configuration
```json
{
  "categories": [
    {
      "name": "Getting Started",
      "order": 1,
      "sections": ["intro", "how-to-play", "building-your-character"]
    },
    {
      "name": "Core Mechanics", 
      "order": 2,
      "sections": ["dice-mechanics", "challenges", "combat"]
    }
  ]
}
```

## Navigation Features
### Sidebar Navigation
- **Hierarchical Tree**: Nested structure matching content organization
- **Collapsible Sections**: Expand/collapse categories and subsections
- **Current Page Highlighting**: Visual indication of active page
- **Smooth Scrolling**: Auto-scroll to active item in long navigation lists
- **Responsive Design**: Collapsible on mobile devices

### Breadcrumb Navigation
- **Dynamic Generation**: Built from current page's hierarchical position
- **Clickable Path**: Each breadcrumb level is navigable
- **Category Context**: Shows which major section user is in
- **Home Link**: Always includes link back to main page

### Table of Contents
- **Auto-Generation**: Extracts H2-H6 headers from current page content
- **Anchor Links**: Click to jump to specific sections
- **Smooth Scrolling**: Animated scroll to target sections
- **Reading Progress**: Optional progress indicator
- **Sticky Positioning**: Stays visible while scrolling

### Sequential Navigation
- **Previous/Next Links**: Navigate through content in logical order
- **Category Boundaries**: Respects content category groupings
- **Skip Empty Sections**: Intelligently skips to next available content
- **Keyboard Support**: Arrow key navigation support

## API Endpoints
### Navigation Data
- **`GET /api/navigation`** - Returns complete navigation tree for player content
- **`GET /api/gm/navigation`** - Returns GM-specific navigation tree
- **Response includes**: Category groupings, hierarchical structure, order information

### Breadcrumb Generation
- **`GET /api/breadcrumbs?slug=content-slug`** - Returns breadcrumb trail for specific content
- **`GET /api/breadcrumbs/category/[slug]`** - Returns breadcrumbs for category pages
- **`GET /api/gm/breadcrumbs/[slug]`** - Returns GM content breadcrumbs

## Responsive Behavior
### Desktop
- **Fixed Sidebar**: Always visible navigation sidebar
- **Full TOC**: Complete table of contents in right sidebar
- **Breadcrumbs**: Full breadcrumb trail in header

### Tablet
- **Collapsible Sidebar**: Slide-out navigation panel
- **Compact TOC**: Condensed table of contents
- **Truncated Breadcrumbs**: Abbreviated breadcrumb trail

### Mobile
- **Hamburger Menu**: Navigation behind menu button
- **Overlay TOC**: Table of contents as overlay/modal
- **Minimal Breadcrumbs**: Essential navigation path only

## State Management
### Navigation State
```typescript
interface NavigationState {
  currentPath: string[];
  expandedSections: string[];
  activeSection: string;
  isGMMode: boolean;
}
```

### Persistence
- **Expanded Sections**: Remembers which navigation sections are open
- **Scroll Position**: Maintains scroll position in navigation
- **Active Highlighting**: Preserves active item state across page loads

## Performance Optimizations
- **Static Generation**: Navigation trees built at compile time
- **Memoized Components**: React.memo for navigation components
- **Lazy Loading**: Large navigation trees loaded incrementally
- **Efficient Updates**: Only re-render changed navigation sections

## Integration Points
- **Search Integration**: Search results show navigation context
- **Content Compilation**: Navigation built from content metadata
- **GM Mode**: Separate navigation trees for different content types
- **Cross-references**: Navigation supports content linking

## Accessibility Features
- **ARIA Labels**: Proper labeling for screen readers
- **Keyboard Navigation**: Full keyboard support for navigation
- **Focus Management**: Logical focus order through navigation
- **High Contrast**: Accessible color schemes for navigation elements

## Development Notes
- Navigation data cached and regenerated on content changes
- Supports multiple content hierarchies (player/GM)
- Configurable category ordering and grouping
- Extensible for additional navigation types and behaviors