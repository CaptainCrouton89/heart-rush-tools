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
  image?: string;
}

export interface NavigationItem {
  slug: string;
  title: string;
  level: number;
  parent?: string;
  order: number;
  children?: NavigationItem[];
}

export interface NavigationCategory {
  name: string;
  sections: string[];
}

export interface CategorizedNavigationItem {
  type: "category" | "section";
  name?: string; // For category headers
  slug?: string; // For sections and categories
  title?: string; // For sections
  level?: number; // For sections
  parent?: string; // For sections
  order: number;
  children?: CategorizedNavigationItem[];
}

export interface SectionData {
  title: string;
  content: string;
  level: number;
}

export interface CompilationConfig {
  name: string;
  sourceDir: string;
  outputDir: string;
  navigationConfigPath?: string;
  enrichSection?: (section: ContentSection, filename: string) => Promise<ContentSection>;
}