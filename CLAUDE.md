# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Heart Rush Digital Rulebook - A Next.js 15 web application that serves as a searchable, wiki-style digital rulebook for the Heart Rush TTRPG. The app transforms large source markdown files into navigable web content with fuzzy search, cross-references, and both player and GM content.

## Development Commands

- `pnpm run dev` - Start development server (includes content compilation and runs on port 3909)
- `pnpm run build` - Production build (compiles content first, then builds Next.js)
- `pnpm run lint` - Run ESLint
- `pnpm run compile-content` - Compile markdown files from heart_rush/ into content/ JSON files
- `pnpm run content:watch` - Watch source markdown files and recompile on changes

## Content Architecture

The app uses a custom content compilation system that transforms source markdown files into structured JSON:

### Source Content Structure

- `heart_rush/all_sections_formatted/` - Main rulebook sections (markdown files)
- `heart_rush/races/` - Individual race files
- `heart_rush/talents/` - Combat and non-combat talent files
- `heart_rush/gm_guide/` - GM-specific content

### Compiled Content Structure

- `content/` - Generated JSON files for player content (gitignored)
- `content/gm/` - Generated JSON files for GM content
- Content is split by headers into individual sections with metadata

### Key Compilation Script

`scripts/compile-content.ts` is the core content processor that:

- Combines race files into a single Kin\_&_Culture.md
- Combines talent files into a single Talents.md
- Processes markdown files and splits them by headers
- Generates slugs, metadata, cross-references, and navigation trees
- Outputs structured JSON for the Next.js app to consume

## Architecture

### Tech Stack

- Next.js 15 with App Router
- TypeScript (strict mode)
- Tailwind CSS
- Fuse.js for search
- Gray-matter for markdown processing

### Key Directories

- `src/app/` - Next.js app router pages and API routes
- `src/components/` - React components (layout, content, search, ui)
- `src/lib/` - Utilities (content loading, search, talent/race processing)
- `src/types/` - TypeScript type definitions
- `scripts/` - Content processing and utility scripts

### Route Structure

- `/[slug]` - Individual content pages
- `/category/[slug]` - Category overview pages
- `/gm/[slug]` - GM-specific content pages
- `/search` - Search results page
- `/tools/monster-generator` - AI-powered monster generation tool
- `/maps/` - Interactive map pages

### Content Loading

Content is loaded server-side from the compiled JSON files. The `src/lib/content.ts` file contains utilities for:

- Loading individual content sections
- Building navigation trees
- Generating breadcrumbs
- Cross-reference resolution

### Search System

Uses Fuse.js for client-side fuzzy search across all content with weighted scoring (titles, headers, content, tags).

## Features

### Core Platform Features
- **Content Compilation System** ([CONTENT_COMPILATION_SYSTEM.md](./CONTENT_COMPILATION_SYSTEM.md)) - Transforms source markdown into optimized JSON content
- **Search System** ([SEARCH_SYSTEM.md](./SEARCH_SYSTEM.md)) - Client-side fuzzy search with tag filtering and real-time results
- **Navigation System** ([NAVIGATION_SYSTEM.md](./NAVIGATION_SYSTEM.md)) - Hierarchical navigation with breadcrumbs and table of contents
- **Content Rendering** ([CONTENT_RENDERING.md](./CONTENT_RENDERING.md)) - Markdown rendering with cross-references and interactive elements
- **Theme System** ([THEME_SYSTEM.md](./THEME_SYSTEM.md)) - Dark/light mode with system preference detection

### GM Tools & Features
- **GM Mode** ([GM_MODE.md](./GM_MODE.md)) - Separate GM content hierarchy and context management
- **AI Monster Generator** ([AI_MONSTER_GENERATOR.md](./AI_MONSTER_GENERATOR.md)) - OpenAI-powered monster stat block generation
- **PDF Export** ([PDF_EXPORT.md](./PDF_EXPORT.md)) - Complete rulebook PDF generation with table formatting

### Interactive Features
- **Maps System** ([MAPS_SYSTEM.md](./MAPS_SYSTEM.md)) - High-resolution interactive map viewing with zoom/pan

## Development Notes

- Content must be compiled before running dev/build (handled automatically by npm scripts)
- TypeScript strict mode enabled
- Port 3909 used for development to avoid conflicts
- Images stored in `public/heart_rush/` and served statically
- No caching in development mode for easier iteration
