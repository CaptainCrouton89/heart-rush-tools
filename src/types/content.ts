export interface ContentSection {
  slug: string;
  title: string;
  category: string;
  level: number;
  parent?: string;
  content: string;
  tags: string[];
  cross_refs: string[];
  word_count: number;
  reading_time: number;
  order: number;
  children?: ContentSection[];
  image?: string;
}

export interface NavigationNode {
  slug: string;
  title: string;
  level: number;
  parent?: string;
  order: number;
  children?: NavigationNode[];
}

export interface SearchResult {
  slug: string;
  title: string;
  category: string;
  snippet: string;
  matches: SearchMatch[];
  score: number;
  level: number;
  tags: string[];
  reading_time: number;
}

export interface SearchMatch {
  field: "title" | "content" | "tags" | "category";
  value: string;
  indices: [number, number][];
}

export interface FilterState {
  categories: string[];
  tags: string[];
  levels: number[];
  readingTimeRange: [number, number];
  searchQuery: string;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  filters: FilterState;
  isOpen: boolean;
  recentSearches: string[];
}

export interface ContentFrontmatter {
  title: string;
  category: string;
  level: number;
  parent?: string;
  order: number;
  tags: string[];
  cross_refs: string[];
  word_count: number;
  reading_time: number;
  description?: string;
}

export interface SourceFrontmatter {
  category: string;
  order: number;
  tags: string[];
  description: string;
}

// Lightweight content metadata (used in index and search)
export interface ContentMetadata {
  slug: string;
  title: string;
  category: string;
  level: number;
  parent?: string;
  tags: string[];
  cross_refs: string[];
  word_count: number;
  reading_time: number;
  order: number;
  image?: string;
}

// Search configuration for Fuse.js
export interface SearchConfig {
  threshold: number;
  includeScore: boolean;
  includeMatches: boolean;
  minMatchCharLength: number;
  keys: Array<{
    name: string;
    weight: number;
  }>;
}

// Theme state
export interface ThemeState {
  mode: 'light' | 'dark' | 'system';
  systemPreference: 'light' | 'dark';
}

// Reading progress state
export interface ReadingProgress {
  currentSlug?: string;
  scrollPosition: number;
  visitedSections: Set<string>;
  bookmarks: string[];
  lastVisited: Date;
}

// Breadcrumb navigation
export interface Breadcrumb {
  slug: string;
  title: string;
  level: number;
}

// Table of contents entry
export interface TocEntry {
  slug: string;
  title: string;
  level: number;
  anchor: string;
}

// Cross-reference link
export interface CrossReference {
  title: string;
  slug: string;
  category: string;
  context: string; // Surrounding text for context
}

// Application state
export interface AppState {
  theme: ThemeState;
  filters: FilterState;
  readingProgress: ReadingProgress;
  navigation: {
    sidebarOpen: boolean;
    tocOpen: boolean;
    searchOpen: boolean;
  };
}

// Error states
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
}

// Loading states
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// API response wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: AppError;
  loading: LoadingState;
}