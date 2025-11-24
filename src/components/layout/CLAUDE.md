# Layout Components

Core layout components for the Heart Rush Digital Rulebook application. These components form the application shell and are used by all pages.

## Component Overview

### AppLayout
- **Purpose**: Root layout wrapper for the entire application
- **Features**:
  - Manages sidebar toggle state
  - Initializes search index on app startup
  - Provides responsive layout (mobile menu + desktop sidebar)
  - Marked as "use client" (client component)

### Sidebar
- **Purpose**: Primary navigation, search, and app controls interface
- **Features**:
  - Mobile-responsive (fixed on mobile, static on desktop)
  - Integrates SearchInput and SearchResults components
  - World switcher for multi-wiki support
  - GM mode toggle (disabled when in world context)
  - Quick access buttons (Maps, Tools, Character Sheet)
  - Context-aware navigation loading (world > GM > regular)
  - Loading skeleton for navigation

### NavigationTree
- **Purpose**: Hierarchical navigation with expandable categories
- **Features**:
  - Handles flat `NavigationNode` and categorized `CategorizedNavigationNode` types
  - Context-aware routing (world > GM > regular priority)
  - Auto-expands parent nodes to show active page
  - Category headers with visual separators
  - Collapsible/expandable sections with smooth animations
  - Visual indicators for hierarchy levels
  - Active state highlighting with gradient backgrounds

### Breadcrumbs
- **Purpose**: Hierarchical page position indicator with context-aware routing
- **Features**:
  - Fetches breadcrumb trail from API based on context
  - Supports three routing contexts: regular, GM mode, and world-specific
  - Loading skeleton during fetch
  - Auto-detects context from pathname and GMContext/WorldContext

### MainContent
- **Purpose**: Wraps page content with standardized styling and structure
- **Features**:
  - Consistent padding/spacing
  - Responsive content width

### TableOfContents
- **Purpose**: In-page navigation for long content
- **Features**:
  - Auto-generates from markdown headers
  - Smooth scroll navigation

### ThemeProvider
- **Purpose**: Dark/light mode theme management
- **Features**:
  - Client-side only rendering to avoid SSR localStorage issues
  - Integrates with next-themes library
  - System preference detection
  - Theme persisted to localStorage

### ThemeToggle
- **Purpose**: UI button for switching themes
- **Features**:
  - Simple toggle between dark/light modes

## Key Patterns

### Context-Aware Routing
Components use a three-tier routing system with priority:
1. **World Context** - Routes like `/world/{worldName}/{slug}` (highest priority)
2. **GM Mode** - Routes like `/gm/{slug}`
3. **Regular** - Routes like `/{slug}` (default)

This enables seamless switching between the main rulebook, GM-only content, and user-created wikis. Breadcrumbs, NavigationTree, and Sidebar all fetch from context-appropriate API endpoints.

### Client Components ("use client")
- All components in this directory are client components
- Required for state management (sidebar toggle, navigation state, search)
- Event handlers for navigation, context switching

### Responsive Design
- Tailwind CSS classes for mobile-first approach
- `lg:` breakpoint separates mobile and desktop layouts
- Sidebar is fixed on mobile, static on desktop
- Mobile overlay when sidebar is open

### SSR Considerations
- `ThemeProvider` defers rendering until client-side mount
- Prevents localStorage errors during server rendering

## Key Dependencies

- `GMContext` - GM mode state management (`isGMMode`, `setGMMode`)
- `WorldContext` - World/wiki selection state management (`currentWorld`, `setCurrentWorld`, `availableWorlds`)
- `next-themes` - Theme provider and utilities
- `SearchInput` and `SearchResults` - Search components in Sidebar
