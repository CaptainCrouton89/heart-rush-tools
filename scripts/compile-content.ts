#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

interface ContentSection {
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
}

interface NavigationItem {
  slug: string;
  title: string;
  level: number;
  parent?: string;
  order: number;
  children?: NavigationItem[];
}

const WORDS_PER_MINUTE = 200;
const SOURCE_DIR = 'heart_rush/all_sections_formatted';
const OUTPUT_DIR = 'content';

function calculateReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function generateSlug(title: string, existingSlugs: Set<string>): string {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  let slug = baseSlug;
  let counter = 1;
  
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  existingSlugs.add(slug);
  return slug;
}

function extractCrossReferences(content: string): string[] {
  const crossRefs: string[] = [];
  
  // Match various cross-reference patterns
  const patterns = [
    /\[([^\]]+)\]\(#([^)]+)\)/g, // [text](#anchor)
    /see\s+([A-Z][^.!?]*)/gi,    // "see Something"
    /refer\s+to\s+([A-Z][^.!?]*)/gi, // "refer to Something"
    /\*\*([^*]+)\*\*/g           // **bold text** (might be references)
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const ref = match[1] || match[2];
      if (ref && !crossRefs.includes(ref)) {
        crossRefs.push(ref);
      }
    }
  });
  
  return crossRefs.slice(0, 10); // Limit to 10 cross-references
}

function extractTags(content: string, title: string): string[] {
  const tags: string[] = [];
  
  // Extract tags from title
  const titleWords = title.toLowerCase().split(/\s+/);
  tags.push(...titleWords.filter(word => word.length > 3));
  
  // Extract common RPG terms
  const rpgTerms = [
    'combat', 'spell', 'talent', 'ability', 'class', 'equipment', 
    'weapon', 'armor', 'journey', 'rest', 'healing', 'condition',
    'magic', 'elementalism', 'paragon', 'basic', 'needs'
  ];
  
  rpgTerms.forEach(term => {
    if (content.toLowerCase().includes(term) || title.toLowerCase().includes(term)) {
      if (!tags.includes(term)) {
        tags.push(term);
      }
    }
  });
  
  return tags.slice(0, 8); // Limit to 8 tags
}

function splitContent(content: string, filename: string): { title: string; content: string; level: number }[] {
  const sections: { title: string; content: string; level: number }[] = [];
  
  // Split on headers (H1, H2, H3)
  const headerRegex = /^(#{1,3})\s+(.+)$/gm;
  let lastIndex = 0;
  let match;
  let currentSection: { title: string; content: string; level: number } | null = null;
  
  // First, create a main section from filename if content doesn't start with header
  const firstHeaderMatch = content.match(headerRegex);
  if (!firstHeaderMatch || content.indexOf(firstHeaderMatch[0]) > 0) {
    const mainTitle = filename.replace(/\.md$/, '').replace(/_/g, ' ').replace(/,/g, ' &');
    currentSection = {
      title: mainTitle,
      content: '',
      level: 1
    };
  }
  
  while ((match = headerRegex.exec(content)) !== null) {
    // Save previous section if it exists
    if (currentSection) {
      currentSection.content = content.slice(lastIndex, match.index).trim();
      if (currentSection.content.length > 0) {
        sections.push(currentSection);
      }
    }
    
    // Start new section
    const level = match[1].length;
    const title = match[2].trim();
    
    currentSection = {
      title,
      content: '',
      level
    };
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add final section
  if (currentSection) {
    currentSection.content = content.slice(lastIndex).trim();
    if (currentSection.content.length > 0) {
      sections.push(currentSection);
    }
  }
  
  // If no sections were found, create one from the entire content
  if (sections.length === 0) {
    const mainTitle = filename.replace(/\.md$/, '').replace(/_/g, ' ').replace(/,/g, ' &');
    sections.push({
      title: mainTitle,
      content: content.trim(),
      level: 1
    });
  }
  
  return sections;
}

async function compileContent(): Promise<void> {
  console.log('Starting content compilation...');
  
  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Read source files
    const sourceFiles = await fs.readdir(SOURCE_DIR);
    const markdownFiles = sourceFiles.filter(file => file.endsWith('.md'));
    
    console.log(`Found ${markdownFiles.length} markdown files to process`);
    
    const allSections: ContentSection[] = [];
    const existingSlugs = new Set<string>();
    let globalOrder = 0;
    
    // Process each file
    for (const filename of markdownFiles.sort()) {
      console.log(`Processing: ${filename}`);
      
      const filePath = path.join(SOURCE_DIR, filename);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // Parse frontmatter
      const { data: frontmatter, content } = matter(fileContent);
      
      // Determine category from filename
      const category = filename.replace(/\.md$/, '').replace(/_/g, ' ').replace(/,/g, ' &');
      
      // Split content into sections
      const sections = splitContent(content, filename);
      
      // Process each section
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const wordCount = countWords(section.content);
        const readingTime = calculateReadingTime(wordCount);
        
        const contentSection: ContentSection = {
          slug: generateSlug(section.title, existingSlugs),
          title: section.title,
          category,
          level: section.level,
          content: section.content,
          tags: extractTags(section.content, section.title),
          cross_refs: extractCrossReferences(section.content),
          word_count: wordCount,
          reading_time: readingTime,
          order: globalOrder++
        };
        
        // Set parent relationship for subsections
        if (section.level > 1 && allSections.length > 0) {
          // Find the most recent section with a lower level
          for (let j = allSections.length - 1; j >= 0; j--) {
            if (allSections[j].level < section.level) {
              contentSection.parent = allSections[j].slug;
              break;
            }
          }
        }
        
        allSections.push(contentSection);
      }
    }
    
    console.log(`Generated ${allSections.length} content sections`);
    
    // Write individual section files
    for (const section of allSections) {
      const sectionPath = path.join(OUTPUT_DIR, `${section.slug}.json`);
      await fs.writeFile(sectionPath, JSON.stringify(section, null, 2));
    }
    
    // Generate navigation tree
    const navigation: NavigationItem[] = [];
    const navigationMap = new Map<string, NavigationItem>();
    
    for (const section of allSections) {
      const navItem: NavigationItem = {
        slug: section.slug,
        title: section.title,
        level: section.level,
        parent: section.parent,
        order: section.order,
        children: []
      };
      
      navigationMap.set(section.slug, navItem);
      
      if (section.parent && navigationMap.has(section.parent)) {
        const parent = navigationMap.get(section.parent)!;
        if (!parent.children) parent.children = [];
        parent.children.push(navItem);
      } else {
        navigation.push(navItem);
      }
    }
    
    // Write navigation file
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'navigation.json'),
      JSON.stringify(navigation, null, 2)
    );
    
    // Write index file with all sections metadata
    const index = allSections.map(section => ({
      slug: section.slug,
      title: section.title,
      category: section.category,
      level: section.level,
      parent: section.parent,
      tags: section.tags,
      cross_refs: section.cross_refs,
      word_count: section.word_count,
      reading_time: section.reading_time,
      order: section.order
    }));
    
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'index.json'),
      JSON.stringify(index, null, 2)
    );
    
    console.log('Content compilation completed successfully!');
    console.log(`- ${allSections.length} sections compiled`);
    console.log(`- Navigation tree generated`);
    console.log(`- Index file created`);
    console.log(`- Output written to ${OUTPUT_DIR}/`);
    
  } catch (error) {
    console.error('Error during content compilation:', error);
    process.exit(1);
  }
}

// Run the compilation
compileContent().catch(console.error);