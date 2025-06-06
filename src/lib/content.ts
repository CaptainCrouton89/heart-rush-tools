import fs from 'fs/promises';
import path from 'path';
import { 
  ContentSection, 
  NavigationNode, 
  ContentMetadata,
  Breadcrumb 
} from '../types/content';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const CACHE = new Map<string, unknown>();

// Helper function to check if we're in development mode
function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Get cached data or load from file
async function getCachedOrLoad<T>(
  key: string,
  loader: () => Promise<T>
): Promise<T> {
  if (!isDevelopment() && CACHE.has(key)) {
    return CACHE.get(key) as T;
  }

  const data = await loader();
  CACHE.set(key, data);
  return data;
}

// Get content by slug
export async function getContentBySlug(slug: string): Promise<ContentSection | null> {
  try {
    const filePath = path.join(CONTENT_DIR, `${slug}.json`);
    const content = await getCachedOrLoad(`content:${slug}`, async () => {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent) as ContentSection;
    });
    
    return content;
  } catch (error) {
    console.error(`Error loading content for slug ${slug}:`, error);
    return null;
  }
}

// Get all content metadata (lightweight version for listings)
export async function getAllContentMetadata(): Promise<ContentMetadata[]> {
  try {
    const indexPath = path.join(CONTENT_DIR, 'index.json');
    const metadata = await getCachedOrLoad('metadata:all', async () => {
      const fileContent = await fs.readFile(indexPath, 'utf-8');
      return JSON.parse(fileContent) as ContentMetadata[];
    });
    
    return metadata.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error('Error loading content metadata:', error);
    return [];
  }
}

// Get all content sections (full content)
export async function getAllContent(): Promise<ContentSection[]> {
  try {
    const metadata = await getAllContentMetadata();
    const contentPromises = metadata.map(item => getContentBySlug(item.slug));
    const contentResults = await Promise.all(contentPromises);
    
    return contentResults.filter((content): content is ContentSection => content !== null);
  } catch (error) {
    console.error('Error loading all content:', error);
    return [];
  }
}

// Get navigation tree
export async function getNavigationTree(): Promise<NavigationNode[]> {
  try {
    const navPath = path.join(CONTENT_DIR, 'navigation.json');
    const navigation = await getCachedOrLoad('navigation:tree', async () => {
      const fileContent = await fs.readFile(navPath, 'utf-8');
      return JSON.parse(fileContent) as NavigationNode[];
    });
    
    return navigation;
  } catch (error) {
    console.error('Error loading navigation tree:', error);
    return [];
  }
}

// Get breadcrumb trail for a given slug
export async function getBreadcrumbs(slug: string): Promise<Breadcrumb[]> {
  try {
    const content = await getContentBySlug(slug);
    if (!content) return [];

    const breadcrumbs: Breadcrumb[] = [];
    const allMetadata = await getAllContentMetadata();
    const metadataMap = new Map(allMetadata.map(item => [item.slug, item]));

    // Build breadcrumb trail by walking up parent chain
    let current: ContentMetadata | undefined = metadataMap.get(slug);
    while (current) {
      breadcrumbs.unshift({
        slug: current.slug,
        title: current.title,
        level: current.level
      });

      if (current.parent) {
        current = metadataMap.get(current.parent);
      } else {
        break;
      }
    }

    return breadcrumbs;
  } catch (error) {
    console.error(`Error getting breadcrumbs for ${slug}:`, error);
    return [];
  }
}

// Get related content based on cross-references and tags
export async function getRelatedContent(slug: string, limit = 5): Promise<ContentSection[]> {
  try {
    const currentContent = await getContentBySlug(slug);
    if (!currentContent) return [];

    const allMetadata = await getAllContentMetadata();
    const related: Array<{ content: ContentMetadata; score: number }> = [];

    for (const metadata of allMetadata) {
      if (metadata.slug === slug) continue;

      let score = 0;

      // Score based on shared tags
      const sharedTags = currentContent.tags.filter(tag => 
        metadata.tags.includes(tag)
      );
      score += sharedTags.length * 3;

      // Score based on same category
      if (metadata.category === currentContent.category) {
        score += 2;
      }

      // Score based on cross-references
      if (currentContent.cross_refs.some(ref => 
        metadata.title.toLowerCase().includes(ref.toLowerCase())
      )) {
        score += 5;
      }

      // Score based on similar level (nearby sections)
      if (Math.abs(metadata.level - currentContent.level) <= 1) {
        score += 1;
      }

      if (score > 0) {
        related.push({ content: metadata, score });
      }
    }

    // Sort by score and get full content for top results
    const topRelated = related
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const relatedContentPromises = topRelated.map(item => 
      getContentBySlug(item.content.slug)
    );
    const relatedContent = await Promise.all(relatedContentPromises);

    return relatedContent.filter((content): content is ContentSection => content !== null);
  } catch (error) {
    console.error(`Error getting related content for ${slug}:`, error);
    return [];
  }
}

// Get content by category
export async function getContentByCategory(category: string): Promise<ContentSection[]> {
  try {
    const allMetadata = await getAllContentMetadata();
    const categoryMetadata = allMetadata.filter(item => 
      item.category.toLowerCase() === category.toLowerCase()
    );

    const contentPromises = categoryMetadata.map(item => getContentBySlug(item.slug));
    const contentResults = await Promise.all(contentPromises);

    return contentResults.filter((content): content is ContentSection => content !== null);
  } catch (error) {
    console.error(`Error loading content for category ${category}:`, error);
    return [];
  }
}

// Get all unique categories
export async function getCategories(): Promise<string[]> {
  try {
    const allMetadata = await getAllContentMetadata();
    const categories = Array.from(new Set(allMetadata.map(item => item.category)));
    return categories.sort();
  } catch (error) {
    console.error('Error loading categories:', error);
    return [];
  }
}

// Get all unique tags
export async function getTags(): Promise<string[]> {
  try {
    const allMetadata = await getAllContentMetadata();
    const tags = Array.from(new Set(allMetadata.flatMap(item => item.tags)));
    return tags.sort();
  } catch (error) {
    console.error('Error loading tags:', error);
    return [];
  }
}

// Get children of a specific content section
export async function getChildContent(parentSlug: string): Promise<ContentSection[]> {
  try {
    const allMetadata = await getAllContentMetadata();
    const childMetadata = allMetadata.filter(item => item.parent === parentSlug);

    const contentPromises = childMetadata.map(item => getContentBySlug(item.slug));
    const contentResults = await Promise.all(contentPromises);

    return contentResults
      .filter((content): content is ContentSection => content !== null)
      .sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error(`Error loading child content for ${parentSlug}:`, error);
    return [];
  }
}

// Get previous and next content in reading order
export async function getAdjacentContent(slug: string): Promise<{
  previous: ContentMetadata | null;
  next: ContentMetadata | null;
}> {
  try {
    const allMetadata = await getAllContentMetadata();
    const currentIndex = allMetadata.findIndex(item => item.slug === slug);

    if (currentIndex === -1) {
      return { previous: null, next: null };
    }

    return {
      previous: currentIndex > 0 ? allMetadata[currentIndex - 1] : null,
      next: currentIndex < allMetadata.length - 1 ? allMetadata[currentIndex + 1] : null
    };
  } catch (error) {
    console.error(`Error getting adjacent content for ${slug}:`, error);
    return { previous: null, next: null };
  }
}

// Search content (basic text search - for more advanced search, use the search utilities)
export async function searchContent(query: string, limit = 10): Promise<ContentSection[]> {
  try {
    if (!query.trim()) return [];

    const allMetadata = await getAllContentMetadata();
    const queryLower = query.toLowerCase();
    
    const matches = allMetadata.filter(item => 
      item.title.toLowerCase().includes(queryLower) ||
      item.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
      item.category.toLowerCase().includes(queryLower)
    );

    const contentPromises = matches
      .slice(0, limit)
      .map(item => getContentBySlug(item.slug));
    const contentResults = await Promise.all(contentPromises);

    return contentResults.filter((content): content is ContentSection => content !== null);
  } catch (error) {
    console.error(`Error searching content for query "${query}":`, error);
    return [];
  }
}

// Clear cache (useful for development or when content updates)
export function clearCache(): void {
  CACHE.clear();
}