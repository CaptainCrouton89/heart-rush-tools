# Content Rendering System

## Overview
Comprehensive markdown rendering system that transforms compiled JSON content into rich, interactive web pages. Handles cross-reference linking, table formatting, image optimization, and custom game-specific components.

## How It Works
1. **Content Loading**: Fetches compiled JSON content via API routes
2. **Markdown Processing**: Renders markdown content with custom components
3. **Cross-reference Resolution**: Automatically links related content sections
4. **Component Enhancement**: Adds interactive elements and game-specific formatting
5. **Responsive Display**: Adapts content layout for different screen sizes

## Key Files
- **`src/components/content/MarkdownRenderer.tsx`** - Core markdown rendering component
- **`src/components/content/CrossReferenceLink.tsx`** - Internal linking component
- **`src/components/content/ChildrenContent.tsx`** - Hierarchical content display
- **`src/components/layout/MainContent.tsx`** - Main content area container
- **`src/lib/content.ts`** - Content loading and processing utilities
- **`src/app/[slug]/page.tsx`** - Dynamic content page routing
- **`src/app/category/[slug]/page.tsx`** - Category overview pages

## Content Structure
### JSON Content Format
```typescript
interface ContentSection {
  slug: string;
  title: string;
  category: string;
  level: number;
  parent?: string;
  content: string;        // Markdown content
  tags: string[];
  cross_refs: string[];   // Auto-detected references
  word_count: number;
  reading_time: number;
  order: number;
  image?: string;
}
```

### Rendered Output
- **Rich HTML**: Semantic HTML from markdown
- **Interactive Links**: Cross-references become clickable links
- **Responsive Tables**: Horizontal scroll for wide tables
- **Optimized Images**: Lazy loading and responsive sizing
- **Custom Components**: Game-specific elements (stat blocks, etc.)

## Markdown Features
### Standard Markdown
- **Headers**: H1-H6 with auto-generated anchors
- **Text Formatting**: Bold, italic, strikethrough, code
- **Lists**: Ordered and unordered lists with nesting
- **Blockquotes**: Styled quote blocks
- **Code Blocks**: Syntax highlighting for code

### Extended Features
- **Tables**: Responsive tables with overflow handling
- **Links**: External links and internal cross-references
- **Images**: Optimized images with alt text and captions
- **Horizontal Rules**: Section dividers
- **Line Breaks**: Proper paragraph handling

### Game-Specific Elements
- **Stat Blocks**: Formatted character/monster statistics
- **Rule Callouts**: Highlighted rule explanations
- **Example Boxes**: Styled example scenarios
- **Reference Tables**: Interactive lookup tables

## Cross-Reference System
### Automatic Detection
```typescript
// Cross-references detected during compilation
cross_refs: ["wounds", "conditions", "heart-die"]
```

### Link Generation
- **Internal Links**: Automatic linking to related content sections
- **Contextual Tooltips**: Preview content on hover
- **Broken Link Detection**: Validation of reference targets
- **Bidirectional Links**: "Referenced by" sections

### Link Types
- **Direct References**: Explicit mentions of other content
- **Tag-based Links**: Links based on shared tags
- **Category Links**: Links to related categories
- **Parent-Child Links**: Hierarchical content relationships

## Component Architecture
### MarkdownRenderer
```typescript
interface MarkdownRendererProps {
  content: string;
  crossRefs?: string[];
  enableTOC?: boolean;
  customComponents?: Record<string, Component>;
}
```

### Custom Components
- **CrossReferenceLink**: Handles internal linking with validation
- **ResponsiveTable**: Tables with horizontal scroll and sorting
- **ImageOptimizer**: Lazy loading and responsive images
- **CalloutBox**: Styled content highlights and warnings

## Page Types
### Individual Content Pages
- **Route**: `/[slug]`
- **Content**: Single content section with full markdown rendering
- **Features**: TOC, cross-references, previous/next navigation
- **Layout**: Full content area with optional sidebar TOC

### Category Overview Pages
- **Route**: `/category/[slug]`
- **Content**: Category introduction plus child content listings
- **Features**: Category navigation, content summaries, tag filters
- **Layout**: Grid layout with content cards

### Child Content Display
- **Hierarchical Rendering**: Shows parent content with nested children
- **Expandable Sections**: Collapsible child content areas
- **Navigation Integration**: Links to full individual pages
- **Reading Progress**: Progress tracking across related sections

## Performance Optimizations
### Content Loading
- **Static Generation**: Pre-rendered pages at build time
- **Incremental Regeneration**: Updates only changed content
- **API Caching**: Cached content responses
- **Lazy Loading**: Images and large content sections

### Rendering Optimizations
- **Component Memoization**: React.memo for expensive components
- **Virtual Scrolling**: For long content sections
- **Progressive Enhancement**: Core content loads first
- **Code Splitting**: Separate bundles for heavy components

## Responsive Design
### Desktop Layout
- **Full Width**: Maximum content area utilization
- **Sidebar TOC**: Fixed table of contents
- **Large Images**: Full-size image display
- **Multi-column**: Complex layouts for wide screens

### Tablet Layout
- **Flexible Columns**: Adaptive column layouts
- **Collapsible TOC**: Space-efficient navigation
- **Medium Images**: Optimized image sizing
- **Touch-Friendly**: Larger interactive elements

### Mobile Layout
- **Single Column**: Linear content flow
- **Floating TOC**: Overlay table of contents
- **Responsive Images**: Mobile-optimized sizes
- **Swipe Navigation**: Touch gestures for navigation

## Error Handling
### Content Errors
- **Missing Content**: Graceful fallbacks for missing sections
- **Broken References**: Clear indicators for invalid links
- **Malformed Markdown**: Error boundaries with helpful messages
- **Image Failures**: Fallback images and error states

### User Experience
- **Loading States**: Skeleton screens during content loading
- **Error Boundaries**: Component-level error isolation
- **Retry Mechanisms**: Automatic retry for failed loads
- **Offline Support**: Cached content for offline viewing

## SEO and Accessibility
### Search Engine Optimization
- **Meta Tags**: Dynamic meta descriptions from content
- **Structured Data**: Rich snippets for game content
- **Semantic HTML**: Proper heading hierarchy and landmarks
- **URL Structure**: SEO-friendly slug-based URLs

### Accessibility Features
- **ARIA Labels**: Screen reader support for all interactive elements
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Logical focus order and visibility
- **High Contrast**: Accessible color schemes and contrast ratios

## Development Notes
- Content rendering supports both player and GM content
- Extensible component system for custom markdown elements
- Configurable cross-reference detection and linking
- Performance monitoring for large content sections