# Search System

## Overview
Client-side fuzzy search system using Fuse.js that enables instant content discovery across the entire Heart Rush rulebook. Provides weighted search results, tag-based filtering, and content snippet previews.

## How It Works
1. **Index Generation**: Search index built at compile time from all content sections
2. **Fuzzy Matching**: Fuse.js performs weighted search across titles, headers, content, and tags
3. **Real-time Results**: Debounced search input provides instant results as user types
4. **Tag Filtering**: Content can be filtered by categories and tags
5. **Result Highlighting**: Search matches highlighted in content snippets

## Key Files
- **`src/lib/search.ts`** - Core search functionality and Fuse.js configuration
- **`src/components/search/SearchInput.tsx`** - Search input component with debouncing
- **`src/components/search/SearchResults.tsx`** - Search results display and formatting
- **`src/app/search/page.tsx`** - Dedicated search page
- **`src/app/search/SearchResults.tsx`** - Search page results component
- **`src/components/TagBrowser.tsx`** - Tag-based content discovery
- **`src/app/api/tags/route.ts`** - API endpoint for tag data

## Search Configuration
```typescript
// Fuse.js weighted search fields
const searchOptions = {
  keys: [
    { name: 'title', weight: 3 },      // Highest priority
    { name: 'content', weight: 1 },    // Base content
    { name: 'tags', weight: 2 }        // Medium priority
  ],
  threshold: 0.4,  // Fuzzy matching sensitivity
  includeMatches: true,  // Highlight matching text
  includeScore: true     // Relevance scoring
}
```

## Search Features
### Instant Search
- **Debounced Input**: 300ms delay prevents excessive API calls
- **Real-time Results**: Updates as user types
- **Keyboard Shortcuts**: Cmd/Ctrl + K opens search
- **Recent Searches**: Persisted search history

### Advanced Filtering
- **Category Filters**: Filter by content sections (combat, classes, etc.)
- **Tag Filters**: Filter by content tags and metadata
- **Content Type**: Filter by specific content types
- **Combined Filters**: Multiple filters can be applied simultaneously

### Result Display
- **Snippet Previews**: Content excerpts with highlighted matches
- **Relevance Scoring**: Results ordered by match quality
- **Context Information**: Shows category, tags, and reading time
- **Direct Navigation**: Click to jump directly to content

## Tag System
### Tag Structure
```typescript
interface Tag {
  name: string;
  count: number;
  category?: string;
  description?: string;
}
```

### Tag Sources
- **Frontmatter Tags**: Manual tags from content authors
- **Auto-generated**: Tags extracted from content analysis
- **Category Tags**: Automatic categorization based on content structure
- **Cross-reference Tags**: Tags from linked content

## API Endpoints
- **`/api/tags`** - Returns all available tags with counts
- **Search powered by client-side index** - No dedicated search API needed

## User Experience
### Search Input
- **Global Search Bar**: Available in site header
- **Focus States**: Clear visual feedback
- **Loading States**: Spinner during search processing
- **Empty States**: Helpful messages when no results found

### Search Results Page
- **URL Persistence**: Search queries preserved in URL
- **Shareable Links**: Direct links to specific searches
- **Pagination**: Large result sets broken into pages
- **Export Options**: Save search results

## Performance Optimizations
- **Client-side Search**: No server round-trips for instant results
- **Index Caching**: Search index cached in browser
- **Debounced Input**: Prevents excessive processing
- **Lazy Loading**: Large result sets loaded incrementally
- **Memory Management**: Efficient index structure

## Search Index Structure
```typescript
interface SearchableContent {
  slug: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  level: number;
  word_count: number;
  reading_time: number;
}
```

## Integration Points
- **Navigation**: Search results link to content pages
- **Cross-references**: Search can find related content
- **Breadcrumbs**: Search results show content location
- **GM Mode**: Separate search indexes for GM vs player content

## Development Notes
- Search index regenerated on each content compilation
- Supports both player and GM content with separate indexes
- Configurable search weights and thresholds
- Extensible for additional search fields and filters