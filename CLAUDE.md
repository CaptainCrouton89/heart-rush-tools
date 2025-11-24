# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Heart Rush Digital Rulebook - A Next.js 15 web application that serves as a searchable, wiki-style digital rulebook for the Heart Rush TTRPG. The app transforms large source markdown files into navigable web content with fuzzy search, cross-references, and both player and GM content. The system also supports multi-world wikis for world-building content.

## Development Commands

- `pnpm run dev` - Start development server (includes content compilation and runs on port 3909)
- `pnpm run build` - Production build (compiles content first, then builds Next.js)
- `pnpm run lint` - Run ESLint
- `pnpm run compile-content` - Compile markdown files from heart_rush/ and world-wikis/ into content/ JSON files
- `pnpm run content:watch` - Watch source markdown files and recompile on changes

## Content Architecture

The app uses a custom content compilation system that transforms source markdown files into structured JSON:

### Rulebook Content Structure

- `heart_rush/all_sections_formatted/` - Main rulebook sections (markdown files)
- `heart_rush/races/` - Individual race files
- `heart_rush/talents/` - Combat and non-combat talent files
- `heart_rush/gm_guide/` - GM-specific content
- `content/` - Generated JSON files for player content (gitignored)
- `content/gm/` - Generated JSON files for GM content

### World Wiki Structure

- `world-wikis/[world-name]/` - Individual world directories (e.g., `alaria/`)
- Each world contains topic categories with individual markdown files
- Compiled into world-specific JSON for navigation and content delivery

### Key Compilation Script

`scripts/compile-content.ts` is the core content processor that:

- Combines race files into a single Kin\_&_Culture.md
- Combines talent files into a single Talents.md
- Processes rulebook markdown files and splits them by headers
- Compiles world wiki content into hierarchical JSON structures
- Generates slugs, metadata, cross-references, and navigation trees
- Outputs structured JSON for the Next.js app to consume

## Architecture

### Tech Stack

- Next.js 15 with App Router
- TypeScript (strict mode)
- Tailwind CSS
- Fuse.js for search
- Gray-matter for markdown processing
- next-themes for dark/light mode

### Key Directories

- `src/app/` - Next.js app router pages and API routes
- `src/components/` - React components (layout, content, search, ui)
- `src/context/` - React context for GMContext and WorldContext
- `src/lib/` - Utilities (content loading, search, talent/race processing)
- `src/types/` - TypeScript type definitions
- `scripts/` - Content processing and utility scripts

### Route Structure

- `/[slug]` - Individual rulebook pages
- `/category/[slug]` - Rulebook category overview pages
- `/gm/[slug]` - GM-specific content pages
- `/world/[world]/[slug]` - World wiki content pages
- `/search` - Search results page
- `/tools/monster-generator` - AI-powered monster generation tool
- `/maps/` - Interactive map pages

### Content Loading

Content is loaded server-side from compiled JSON files. The `src/lib/content.ts` file contains utilities for:

- Loading individual rulebook sections and world wiki content
- Building navigation trees for both rulebook and worlds
- Generating breadcrumbs
- Cross-reference resolution

### Search System

Uses Fuse.js for client-side fuzzy search across rulebook content with weighted scoring (titles, headers, content, tags).

## Features

### Core Platform Features
- **Content Compilation System** - Transforms source markdown into optimized JSON content for rulebook and world wikis
- **Search System** - Client-side fuzzy search with tag filtering and real-time results
- **Navigation System** - Hierarchical navigation with breadcrumbs and table of contents for both rulebook and worlds
- **Content Rendering** - Markdown rendering with cross-references and interactive elements
- **Theme System** - Dark/light mode with system preference detection

### GM Tools & Features
- **GM Mode** - Separate GM content hierarchy and context management
- **AI Monster Generator** - OpenAI-powered monster stat block generation
- **PDF Export** - Complete rulebook PDF generation with table formatting

### Interactive Features
- **Maps System** - High-resolution interactive map viewing with zoom/pan
- **Multi-World Wikis** - Support for multiple world-building wikis with independent content hierarchies

## Development Notes

- Content must be compiled before running dev/build (handled automatically by npm scripts)
- TypeScript strict mode enabled
- Port 3909 used for development to avoid conflicts
- Images stored in `public/heart_rush/` and served statically
- No caching in development mode for easier iteration
- World wiki content lives in `world-wikis/` directory structure
