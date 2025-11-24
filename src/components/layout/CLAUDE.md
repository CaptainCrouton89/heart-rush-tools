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
- **Purpose**: Primary navigation and search interface
- **Features**:
  - Mobile-responsive (collapsible on small screens)
  - Integrates search functionality
  - Navigation links to main sections
  - Theme toggle

### MainContent
- **Purpose**: Wraps page content with standardized styling and structure
- **Features**:
  - Consistent padding/spacing
  - Responsive content width

### NavigationTree
- **Purpose**: Hierarchical navigation display
- **Features**:
  - Renders nested category/page structure
  - Active state highlighting
  - Link generation for routing

### Breadcrumbs
- **Purpose**: Hierarchical page position indicator
- **Features**:
  - Builds breadcrumb trail from page hierarchy
  - Links for parent navigation

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

### Client Components ("use client")
- `AppLayout` and `ThemeProvider` are client components
- Required for state management and event handlers
- SSR hydration handled gracefully in `ThemeProvider`

### Responsive Design
- Tailwind CSS classes for mobile-first approach
- `lg:` breakpoint for desktop layouts
- Mobile hamburger menu for navigation

### SSR Considerations
- `ThemeProvider` defers rendering until client-side mount
- Prevents localStorage errors during server rendering
