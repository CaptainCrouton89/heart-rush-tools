import Fuse from 'fuse.js';
import { 
  ContentMetadata, 
  SearchResult, 
  SearchConfig, 
  SearchMatch,
  FilterState 
} from '../types/content';

// Default search configuration optimized for documentation search
const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  threshold: 0.3, // 0 = perfect match, 1 = match anything
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  keys: [
    { name: 'title', weight: 3 },      // Highest weight for titles
    { name: 'content', weight: 2 },    // Medium weight for content
    { name: 'tags', weight: 1.5 },     // Good weight for tags
    { name: 'category', weight: 1 },   // Lower weight for category
  ]
};

// Cache for search index
let searchIndex: Fuse<ContentMetadata> | null = null;
let searchData: ContentMetadata[] = [];

// Fetch content metadata from API
async function fetchContentMetadata(): Promise<ContentMetadata[]> {
  try {
    console.log('Fetching content metadata from API...');
    const url = '/api/content/metadata';
    console.log('Fetch URL:', url);
    const response = await fetch(url);
    console.log('API response status:', response.status, response.statusText);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Successfully fetched metadata:', data.length, 'items');
    return data;
  } catch (error) {
    console.error('Error fetching content metadata:', error);
    console.error('Error type:', typeof error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    return [];
  }
}

// Initialize search index
export async function initializeSearchIndex(): Promise<void> {
  try {
    console.log('Initializing search index...');
    searchData = await fetchContentMetadata();
    console.log('Fetched metadata:', searchData.length, 'items');
    
    // Create Fuse configuration
    const fuseConfig = {
      threshold: DEFAULT_SEARCH_CONFIG.threshold,
      includeScore: DEFAULT_SEARCH_CONFIG.includeScore,
      includeMatches: DEFAULT_SEARCH_CONFIG.includeMatches,
      minMatchCharLength: DEFAULT_SEARCH_CONFIG.minMatchCharLength,
      keys: DEFAULT_SEARCH_CONFIG.keys.map(key => ({
        name: key.name as keyof ContentMetadata,
        weight: key.weight
      }))
    };

    searchIndex = new Fuse(searchData, fuseConfig);
    console.log('Search index initialized successfully');
  } catch (error) {
    console.error('Failed to initialize search index:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    searchData = [];
    searchIndex = null;
  }
}

// Get search index (initialize if needed)
async function getSearchIndex(): Promise<Fuse<ContentMetadata> | null> {
  if (!searchIndex) {
    await initializeSearchIndex();
  }
  return searchIndex;
}

// Convert Fuse.js results to our SearchResult format
function convertFuseResults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fuseResults: any[],
  query: string
): SearchResult[] {
  return fuseResults.map(result => {
    const item = result.item;
    const matches: SearchMatch[] = [];
    
    // Convert Fuse matches to our format
    if (result.matches) {
      for (const match of result.matches) {
        if (match.key && match.indices) {
          matches.push({
            field: match.key as SearchMatch['field'],
            value: match.value || '',
            indices: match.indices
          });
        }
      }
    }

    // Generate snippet from content or use first few words of title
    const snippet = generateSnippet(item, query, matches);

    return {
      slug: item.slug,
      title: item.title,
      category: item.category,
      snippet,
      matches,
      score: result.score || 0,
      level: item.level,
      tags: item.tags,
      reading_time: item.reading_time
    };
  });
}

// Generate a snippet with highlighted search terms
function generateSnippet(
  item: ContentMetadata, 
  query: string, 
  matches: SearchMatch[]
): string {
  // If we have content matches, try to extract context around the match
  const contentMatch = matches.find(m => m.field === 'content');
  if (contentMatch && contentMatch.indices.length > 0) {
    const [start, end] = contentMatch.indices[0];
    const fullValue = contentMatch.value;
    
    // Extract context around the match (±50 characters)
    const contextStart = Math.max(0, start - 50);
    const contextEnd = Math.min(fullValue.length, end + 50);
    
    let snippet = fullValue.substring(contextStart, contextEnd);
    
    // Add ellipsis if we truncated
    if (contextStart > 0) snippet = '...' + snippet;
    if (contextEnd < fullValue.length) snippet = snippet + '...';
    
    return snippet;
  }

  // If we have title matches, use the title
  const titleMatch = matches.find(m => m.field === 'title');
  if (titleMatch) {
    return titleMatch.value;
  }

  // Fallback: use title and category
  return `${item.title} (${item.category})`;
}

// Main search function
export async function searchContent(
  query: string,
  filters?: Partial<FilterState>,
  limit = 20
): Promise<SearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  const fuse = await getSearchIndex();
  if (!fuse) {
    console.error('Search index not available');
    return [];
  }

  try {
    // Perform search
    const fuseResults = fuse.search(query, { limit: Math.min(limit, 100) });
    
    // Convert to our format
    let results = convertFuseResults(fuseResults, query);

    // Apply filters if provided
    if (filters) {
      results = applyFilters(results, filters);
    }

    // Limit final results
    return results.slice(0, limit);
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

// Apply filters to search results
function applyFilters(results: SearchResult[], filters: Partial<FilterState>): SearchResult[] {
  let filtered = results;

  // Filter by categories
  if (filters.categories && filters.categories.length > 0) {
    filtered = filtered.filter(result => 
      filters.categories!.includes(result.category)
    );
  }

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(result =>
      filters.tags!.some(tag => result.tags.includes(tag))
    );
  }

  // Filter by levels
  if (filters.levels && filters.levels.length > 0) {
    filtered = filtered.filter(result =>
      filters.levels!.includes(result.level)
    );
  }

  // Filter by reading time range
  if (filters.readingTimeRange) {
    const [min, max] = filters.readingTimeRange;
    filtered = filtered.filter(result =>
      result.reading_time >= min && result.reading_time <= max
    );
  }

  return filtered;
}

// Get search suggestions based on partial query
export async function getSearchSuggestions(
  partialQuery: string,
  limit = 5
): Promise<string[]> {
  if (partialQuery.length < 2) {
    return [];
  }

  const fuse = await getSearchIndex();
  if (!fuse) {
    return [];
  }

  try {
    // Search with more relaxed threshold for suggestions
    const results = fuse.search(partialQuery, { 
      limit: limit * 2
    });

    // Extract unique titles and first few words
    const suggestions = new Set<string>();
    
    for (const result of results) {
      // Add the full title
      suggestions.add(result.item.title);
      
      // Add individual words from title for partial matching
      const words = result.item.title.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length >= 3 && word.startsWith(partialQuery.toLowerCase())) {
          suggestions.add(word);
        }
      }
      
      // Add tags that match
      for (const tag of result.item.tags) {
        if (tag.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(tag);
        }
      }
    }

    return Array.from(suggestions).slice(0, limit);
  } catch (error) {
    console.error('Failed to get search suggestions:', error);
    return [];
  }
}

// Get popular search terms based on tag frequency
export async function getPopularSearchTerms(limit = 10): Promise<string[]> {
  if (searchData.length === 0) {
    searchData = await fetchContentMetadata();
  }

  try {
    // Count tag frequency
    const tagCounts = new Map<string, number>();
    
    for (const item of searchData) {
      for (const tag of item.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Sort by frequency and return top terms
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);
  } catch (error) {
    console.error('Failed to get popular search terms:', error);
    return [];
  }
}

// Search within a specific category
export async function searchInCategory(
  query: string,
  category: string,
  limit = 10
): Promise<SearchResult[]> {
  const results = await searchContent(query, { categories: [category] }, limit);
  return results;
}

// Search by tags
export async function searchByTags(
  tags: string[],
  limit = 20
): Promise<SearchResult[]> {
  if (tags.length === 0) {
    return [];
  }

  // Create a synthetic query from tags
  const query = tags.join(' ');
  return await searchContent(query, { tags }, limit);
}

// Clear search cache (useful for development or when content updates)
export function clearSearchCache(): void {
  searchIndex = null;
  searchData = [];
}

// Get search statistics
export async function getSearchStats(): Promise<{
  totalContent: number;
  categories: string[];
  tags: string[];
  averageReadingTime: number;
}> {
  if (searchData.length === 0) {
    searchData = await fetchContentMetadata();
  }

  const categories = Array.from(new Set(searchData.map(item => item.category)));
  const tags = Array.from(new Set(searchData.flatMap(item => item.tags)));
  const totalReadingTime = searchData.reduce((sum, item) => sum + item.reading_time, 0);
  const averageReadingTime = searchData.length > 0 ? totalReadingTime / searchData.length : 0;

  return {
    totalContent: searchData.length,
    categories: categories.sort(),
    tags: tags.sort(),
    averageReadingTime: Math.round(averageReadingTime)
  };
}