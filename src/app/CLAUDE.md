# App Router Directory

This directory contains the Next.js 15 App Router structure for the Heart Rush Digital Rulebook.

## Route Organization

### Main Routes
- **`[slug]`** - Dynamic content pages for rulebook sections and races
- **`[slug]/layout.tsx`** - Content page layout with sidebar navigation
- **`all-rules`** - Complete rulebook index page
- **`category/[slug]`** - Category overview pages (e.g., Talents, Races)
- **`page.tsx`** - Homepage

### GM Content
- **`gm/[slug]`** - GM-specific content pages with separate navigation

### World & Wikis
- **`world/[slug]`** - World-specific content pages
- **`api/world/`** and **`api/worlds/`** - World management API routes

### Tools & Features
- **`api/`** - API routes (e.g., OpenAI monster generation)
- **`search`** - Search results page with Fuse.js integration
- **`tools/`** - Feature-specific pages (monster-generator, etc.)
- **`maps/`** - Interactive map viewing pages

## Root Layout & Providers

The root `layout.tsx` wraps all routes with essential providers in this order:

1. **ThemeProvider** - Handles dark/light mode with system preference detection
2. **GMProvider** - Manages GM mode state and context
3. **WorldProvider** - Manages world selection and world-specific state

Font loading (Geist Sans/Mono) is configured with swap display and preloading for performance. Polyfills are imported to ensure browser compatibility throughout the app.

## Key Patterns

### Content Pages
- Use server-side rendering with `generateStaticParams` for known slugs
- Load content from compiled JSON in `content/` directory
- Include breadcrumb navigation and table of contents
- Support cross-reference linking via markdown processing

### Layout Hierarchy
- Root layout handles global navigation, theme, and context providers
- Content pages use consistent sidebar + main content layout
- GM pages use separate layout for GM-only content
- World pages use world-specific layout and context

## Important Notes

- All content pages are static/SSG where possible for performance
- Dynamic content sections are built at compile time from `scripts/compile-content.ts`
- Search functionality is client-side using Fuse.js
- API routes handle external integrations (OpenAI for monster generation, world management)
- Root layout suppresses hydration warnings to handle theme provider mismatch
