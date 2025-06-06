#!/usr/bin/env tsx
import fs from "fs/promises";
import matter from "gray-matter";
import path from "path";

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
const SOURCE_DIR = "heart_rush/all_sections_formatted";
const OUTPUT_DIR = "content";

function calculateReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function generateSlug(title: string, existingSlugs: Set<string>): string {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
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
    /see\s+([A-Z][^.!?]*)/gi, // "see Something"
    /refer\s+to\s+([A-Z][^.!?]*)/gi, // "refer to Something"
    /\*\*([^*]+)\*\*/g, // **bold text** (might be references)
  ];

  patterns.forEach((pattern) => {
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
  tags.push(...titleWords.filter((word) => word.length > 3));

  // Extract common RPG terms
  const rpgTerms = [
    "combat",
    "spell",
    "talent",
    "ability",
    "class",
    "equipment",
    "weapon",
    "armor",
    "journey",
    "rest",
    "healing",
    "condition",
    "magic",
    "elementalism",
    "paragon",
    "basic",
    "needs",
  ];

  rpgTerms.forEach((term) => {
    if (
      content.toLowerCase().includes(term) ||
      title.toLowerCase().includes(term)
    ) {
      if (!tags.includes(term)) {
        tags.push(term);
      }
    }
  });

  return tags.slice(0, 8); // Limit to 8 tags
}

function splitContent(
  content: string,
  filename: string
): { title: string; content: string; level: number }[] {
  const sections: { title: string; content: string; level: number }[] = [];

  // Split on headers (H1, H2, H3, H4, H5, H6)
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const matches: Array<{ index: number; level: number; title: string }> = [];
  
  let match;
  while ((match = headerRegex.exec(content)) !== null) {
    matches.push({
      index: match.index,
      level: match[1].length,
      title: match[2].trim(),
    });
  }

  // If no headers found, create one section from entire content
  if (matches.length === 0) {
    const mainTitle = filename
      .replace(/\.md$/, "")
      .replace(/_/g, " ")
      .replace(/,/g, " &");
    sections.push({
      title: mainTitle,
      content: content.trim(),
      level: 1,
    });
    return sections;
  }

  // Process each header and its content
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];
    
    // Calculate start position (after the header line)
    const headerEnd = content.indexOf('\n', currentMatch.index);
    const startPos = headerEnd === -1 ? currentMatch.index : headerEnd + 1;
    
    // Calculate end position
    const endPos = nextMatch ? nextMatch.index : content.length;
    
    // Extract content for this section
    let sectionContent = content.slice(startPos, endPos).trim();
    
    // For parent sections, include content that appears before any child headers
    // This ensures introductory content for classes/subclasses is captured
    if (i + 1 < matches.length) {
      const nextLevel = matches[i + 1].level;
      if (nextLevel > currentMatch.level) {
        // This section has children - include all content up to the first child
        const contentBeforeChildren = content.slice(startPos, matches[i + 1].index).trim();
        sectionContent = contentBeforeChildren;
      }
    }
    
    // Only add sections with meaningful content
    if (sectionContent.length > 0) {
      sections.push({
        title: currentMatch.title,
        content: sectionContent,
        level: currentMatch.level,
      });
    }
  }

  // If content exists before the first header, create a main section
  if (matches.length > 0 && matches[0].index > 0) {
    const preHeaderContent = content.slice(0, matches[0].index).trim();
    if (preHeaderContent.length > 0) {
      const mainTitle = filename
        .replace(/\.md$/, "")
        .replace(/_/g, " ")
        .replace(/,/g, " &");
      sections.unshift({
        title: mainTitle,
        content: preHeaderContent,
        level: 1,
      });
    }
  }

  return sections;
}

async function compileContent(): Promise<void> {
  console.log("Starting content compilation...");

  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Read source files
    const sourceFiles = await fs.readdir(SOURCE_DIR);
    const markdownFiles = sourceFiles.filter((file) => file.endsWith(".md"));

    console.log(`Found ${markdownFiles.length} markdown files to process`);

    const allSections: ContentSection[] = [];
    const existingSlugs = new Set<string>();
    let globalOrder = 0;

    // Process each file
    for (const filename of markdownFiles.sort()) {
      console.log(`Processing: ${filename}`);

      const filePath = path.join(SOURCE_DIR, filename);
      const fileContent = await fs.readFile(filePath, "utf-8");

      // Parse frontmatter
      const { content } = matter(fileContent);

      // Determine category from filename
      const category = filename
        .replace(/\.md$/, "")
        .replace(/_/g, " ")
        .replace(/,/g, " &");

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
          order: globalOrder++,
        };

        // Set parent relationship for subsections
        if (section.level > 1 && allSections.length > 0) {
          // Find the most recent section with exactly one level lower
          // This creates proper hierarchy: level 2 -> level 1, level 3 -> level 2, etc.
          for (let j = allSections.length - 1; j >= 0; j--) {
            const candidateParent = allSections[j];
            if (candidateParent.level === section.level - 1) {
              contentSection.parent = candidateParent.slug;
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
        children: [],
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
      path.join(OUTPUT_DIR, "navigation.json"),
      JSON.stringify(navigation, null, 2)
    );

    // Write index file with all sections metadata
    const index = allSections.map((section) => ({
      slug: section.slug,
      title: section.title,
      category: section.category,
      level: section.level,
      parent: section.parent,
      tags: section.tags,
      cross_refs: section.cross_refs,
      word_count: section.word_count,
      reading_time: section.reading_time,
      order: section.order,
    }));

    await fs.writeFile(
      path.join(OUTPUT_DIR, "index.json"),
      JSON.stringify(index, null, 2)
    );

    console.log("Content compilation completed successfully!");
    console.log(`- ${allSections.length} sections compiled`);
    console.log(`- Navigation tree generated`);
    console.log(`- Index file created`);
    console.log(`- Output written to ${OUTPUT_DIR}/`);
  } catch (error) {
    console.error("Error during content compilation:", error);
    process.exit(1);
  }
}

// Run the compilation
compileContent().catch(console.error);
