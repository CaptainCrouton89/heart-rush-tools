# GM Mode System

## Overview
Specialized mode for Game Masters that provides access to GM-only content, tools, and navigation. Maintains separate content hierarchy, context state, and user interface adaptations specifically designed for campaign management and game running.

## How It Works
1. **Context Toggle**: React context manages GM mode state across the application
2. **Separate Content**: GM content compiled and served separately from player content
3. **Restricted Access**: GM-only content hidden from regular users
4. **Tool Integration**: Special tools and features only available in GM mode
5. **State Persistence**: GM mode preference saved in localStorage

## Key Files
- **`src/context/GMContext.tsx`** - React context for GM mode state management
- **`src/app/gm/[slug]/page.tsx`** - GM content page routing
- **`src/app/api/gm/navigation/route.ts`** - GM navigation API endpoint
- **`src/app/api/gm/breadcrumbs/[slug]/route.ts`** - GM breadcrumb generation
- **`gm-navigation-categories.json`** - GM content category configuration
- **`heart_rush/gm_guide/`** - Source GM content directory
- **`content/gm/`** - Compiled GM content output

## GM Context Structure
```typescript
interface GMContextType {
  isGMMode: boolean;
  toggleGMMode: () => void;
  gmContent: GMContentSection[];
  gmNavigation: NavigationCategory[];
}
```

### State Management
- **Boolean Toggle**: Simple on/off state for GM mode
- **Persistent Storage**: State saved to localStorage
- **App-wide Access**: Context available throughout component tree
- **React Integration**: Hooks-based API for components

## GM Content System
### Content Structure
```typescript
interface GMContentSection {
  slug: string;
  title: string;
  category: string;
  level: number;
  content: string;
  tags: string[];
  gm_only: boolean;        // Flag for GM-only content
  player_safe?: boolean;   // Safe to share with players
  spoiler_level: number;   // Spoiler sensitivity (1-5)
}
```

### Content Categories
- **Monstrous Races**: Advanced creature information
- **Pacing Guide**: Campaign management advice
- **Weather & Events**: Random encounter tables
- **Timescale Management**: Campaign timeline tools
- **Adventure Hooks**: Plot and scenario ideas

### Content Compilation
- **Separate Pipeline**: GM content processed independently
- **Security Measures**: GM content never exposed to player API
- **Metadata Enhancement**: Additional GM-specific metadata
- **Cross-referencing**: Links between GM and player content

## Navigation Differences
### GM Navigation Tree
```json
{
  "categories": [
    {
      "name": "Campaign Management",
      "sections": ["pacing-guide", "timescale", "session-planning"]
    },
    {
      "name": "Creatures & NPCs", 
      "sections": ["monstrous-races", "npc-generation", "behavioral-tables"]
    },
    {
      "name": "World Building",
      "sections": ["weather-events", "adventure-hooks", "location-generators"]
    }
  ]
}
```

### Route Structure
- **`/gm/[slug]`** - GM content pages with special layout
- **Separate API Routes** - Independent from player content APIs
- **Security Boundary** - GM routes require GM mode context
- **Fallback Handling** - Redirects non-GM users appropriately

## UI/UX Adaptations
### Visual Indicators
- **Mode Badge**: Clear indicator when in GM mode
- **Color Scheme**: Subtle visual distinction (e.g., red accent)
- **Navigation Styling**: Different styling for GM navigation
- **Content Warnings**: Spoiler alerts and player-safety indicators

### Functionality Changes
- **Extended Search**: Search includes GM-only content
- **Tool Access**: Monster generator and other GM tools enabled
- **Export Options**: GM-specific export formats and options
- **Advanced Features**: Additional customization options

## Security Features
### Content Protection
- **Server-side Filtering**: GM content never sent to non-GM clients
- **Route Protection**: GM routes check context state
- **API Boundaries**: Separate API endpoints prevent accidental exposure
- **Build-time Separation**: GM content compiled separately

### Access Control
- **Client-side State**: GM mode is user preference, not authentication
- **No Server Authentication**: Relies on user honesty and client state
- **Clear Boundaries**: Obvious separation between player and GM content
- **Graceful Degradation**: App works fully without GM mode

## Integration Points
### Monster Generator
- **GM Tool**: Only available in GM mode
- **Enhanced Features**: Additional customization options for GMs
- **Content Integration**: Generated monsters can reference GM content
- **Campaign Integration**: Tools for adding monsters to campaigns

### Search System
- **Separate Index**: GM content has its own search index
- **Combined Results**: Option to search both player and GM content
- **Content Filtering**: Results marked with GM-only indicators
- **Advanced Queries**: GM-specific search capabilities

### PDF Export
- **GM Supplements**: Export GM-only content as separate PDFs
- **Campaign Handouts**: Generate player-safe versions of GM content
- **Custom Compilations**: Create custom rulebook compilations
- **Annotation Support**: GM notes and modifications in exports

## Development Patterns
### Context Usage
```typescript
// Using GM context in components
const { isGMMode, toggleGMMode } = useGMContext();

// Conditional rendering based on GM mode
{isGMMode && <GMOnlyComponent />}

// Navigation adaptation
const navigation = isGMMode ? gmNavigation : playerNavigation;
```

### Content Loading
```typescript
// Load appropriate content based on mode
const content = isGMMode 
  ? await getGMContent(slug)
  : await getPlayerContent(slug);
```

## Performance Considerations
### Lazy Loading
- **GM Content**: Only loaded when GM mode is activated
- **Tool Components**: GM tools loaded on-demand
- **Separate Bundles**: GM-specific code in separate chunks
- **Memory Management**: Cleanup when exiting GM mode

### Caching Strategy
- **Separate Caches**: GM content cached independently
- **Cache Invalidation**: Clear GM cache when mode disabled
- **Selective Loading**: Only load GM data when needed
- **Background Prefetch**: Prefetch GM content after mode activation

## Future Extensibility
### Planned Features
- **Campaign Management**: Session planning and note-taking tools
- **NPC Generator**: AI-powered NPC creation similar to monster generator
- **Encounter Builder**: Combat encounter balancing tools
- **Plot Generator**: Story and adventure generation assistance

### Architecture Support
- **Plugin System**: Framework for adding GM tools
- **User Accounts**: Future authentication for true GM accounts
- **Collaboration**: Multi-GM campaign management
- **Cloud Sync**: Campaign data synchronization across devices

## Development Notes
- GM mode is preference-based, not security-based
- All GM content compilation happens at build time
- Context state persists across browser sessions
- GM features designed to be additive to core functionality