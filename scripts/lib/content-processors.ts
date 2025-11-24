import fs from "fs/promises";
import matter from "gray-matter";
import path from "path";
import { SectionData, ContentSection, CompilationConfig, NavigationCategory } from "./types.js";
import {
  generateSlug,
  countWords,
  calculateReadingTime,
  extractTags,
  extractCrossReferences
} from "./utils.js";
import { loadNavigationCategories, createCategorizedNavigation } from "./navigation-builder.js";

function formatTitleFromFilename(filename: string): string {
  const normalizedPath = filename.replace(/\\/g, "/");
  const baseName = normalizedPath.substring(normalizedPath.lastIndexOf("/") + 1);
  return baseName
    .replace(/\.md$/, "")
    .replace(/_/g, " ")
    .replace(/,/g, " &");
}

export function splitContent(
  content: string,
  filename: string
): SectionData[] {
  const sections: SectionData[] = [];

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
    const mainTitle = formatTitleFromFilename(filename);
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
    const headerEnd = content.indexOf("\n", currentMatch.index);
    const startPos = headerEnd === -1 ? currentMatch.index : headerEnd + 1;

    // Calculate end position
    const endPos = nextMatch ? nextMatch.index : content.length;

    // Extract content for this section
    let sectionContent = content.slice(startPos, endPos).trim();

    // Check if this section has children (subsections)
    let hasChildren = false;
    if (i + 1 < matches.length) {
      const nextLevel = matches[i + 1].level;
      if (nextLevel > currentMatch.level) {
        hasChildren = true;
        // This section has children - include all content up to the first child
        const contentBeforeChildren = content
          .slice(startPos, matches[i + 1].index)
          .trim();
        sectionContent = contentBeforeChildren;
      }
    }

    // For level 1 headers (main sections), always create the section even if no immediate content
    // This ensures main category sections exist even when they only contain subsections
    if (currentMatch.level === 1) {
      // If no content, create a minimal section with the filename-based description
      if (sectionContent.length === 0) {
        const categoryName = formatTitleFromFilename(filename);
        sectionContent = `This section contains information about ${categoryName.toLowerCase()}.`;
      }

      sections.push({
        title: currentMatch.title,
        content: sectionContent,
        level: currentMatch.level,
      });
    } else if (sectionContent.length > 0 || hasChildren) {
      // For non-level-1 sections, add if they have content OR children
      sections.push({
        title: currentMatch.title,
        content: sectionContent,
        level: currentMatch.level,
      });
    } else {
      // Warn about sections with no content that will be excluded
      console.warn(
        `⚠️  Section excluded from navigation (no content): "${currentMatch.title}" (H${currentMatch.level})`
      );
    }
  }

  // If content exists before the first header, create a main section
  if (matches.length > 0 && matches[0].index > 0) {
    const preHeaderContent = content.slice(0, matches[0].index).trim();
    if (preHeaderContent.length > 0) {
      const mainTitle = formatTitleFromFilename(filename);
      sections.unshift({
        title: mainTitle,
        content: preHeaderContent,
        level: 1,
      });
    }
  }

  return sections;
}

/**
 * Process a split section into a ContentSection with metadata
 */
export function processContentSection(
  section: SectionData,
  category: string,
  existingSlugs: Set<string>,
  order: number
): ContentSection {
  const wordCount = countWords(section.content);
  const readingTime = calculateReadingTime(wordCount);

  return {
    slug: generateSlug(section.title, existingSlugs),
    title: section.title,
    category,
    level: section.level,
    content: section.content,
    tags: extractTags(section.content, section.title),
    cross_refs: extractCrossReferences(section.content),
    word_count: wordCount,
    reading_time: readingTime,
    order,
  };
}

/**
 * Build parent relationships for sections within a file
 */
export function buildParentRelationships(
  sections: ContentSection[]
): void {
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    if (section.level > 1) {
      let bestParent: ContentSection | null = null;

      // Look backwards through previous sections in this file
      for (let j = i - 1; j >= 0; j--) {
        const candidateParent = sections[j];
        if (candidateParent.level < section.level) {
          // Prefer exact level difference (level 2 -> level 1, level 3 -> level 2)
          if (candidateParent.level === section.level - 1) {
            bestParent = candidateParent;
            break;
          }
          // But if no exact match, use any valid parent (level 3 -> level 1 if no level 2)
          if (!bestParent) {
            bestParent = candidateParent;
          }
        }
      }

      if (bestParent) {
        section.parent = bestParent.slug;
      }
    }
  }
}

/**
 * Write compilation output files (sections, navigation, index)
 */
export async function writeCompilationOutput(
  outputDir: string,
  sections: ContentSection[],
  categories: NavigationCategory[]
): Promise<void> {
  // Write individual section files
  for (const section of sections) {
    const sectionPath = path.join(outputDir, `${section.slug}.json`);
    await fs.writeFile(sectionPath, JSON.stringify(section, null, 2));
  }

  // Generate and write categorized navigation
  const categorizedNavigation = createCategorizedNavigation(sections, categories);
  await fs.writeFile(
    path.join(outputDir, "navigation.json"),
    JSON.stringify(categorizedNavigation, null, 2)
  );

  // Write index file with all sections metadata
  const index = sections.map((section) => ({
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
    ...(section.image && { image: section.image }),
  }));

  await fs.writeFile(
    path.join(outputDir, "index.json"),
    JSON.stringify(index, null, 2)
  );
}

/**
 * Unified content compilation pipeline
 */
export async function compileContentPipeline(
  config: CompilationConfig
): Promise<void> {
  console.log(`Starting ${config.name} compilation...`);

  try {
    // Ensure output directory exists
    await fs.mkdir(config.outputDir, { recursive: true });

    // Read source files
    const sourceFiles = await fs.readdir(config.sourceDir);
    const markdownFiles = sourceFiles.filter(
      (file) => file.endsWith(".md") && file !== "CLAUDE.md" && file !== ".claude-md-manager.md"
    );

    console.log(`Found ${markdownFiles.length} markdown files to process`);

    const allSections: ContentSection[] = [];
    const existingSlugs = new Set<string>();
    let globalOrder = 0;

    // Process each file
    for (const filename of markdownFiles.sort()) {
      console.log(`Processing: ${filename}`);

      const filePath = path.join(config.sourceDir, filename);
      const fileContent = await fs.readFile(filePath, "utf-8");

      // Parse frontmatter
      const { data: frontMatter, content } = matter(fileContent);

      // Determine category from frontmatter or filename
      const category = frontMatter.category ||
        filename
          .replace(/\.md$/, "")
          .replace(/_/g, " ")
          .replace(/,/g, " &");

      // Split content into sections
      const sections = splitContent(content, filename);

      // Keep track of sections from current file for proper parent relationships
      const fileSections: ContentSection[] = [];

      // Process each section
      for (const section of sections) {
        const contentSection = processContentSection(
          section,
          category,
          existingSlugs,
          globalOrder++
        );

        // Apply optional enrichment (e.g., add race images)
        const enrichedSection = config.enrichSection
          ? await config.enrichSection(contentSection, filename)
          : contentSection;

        fileSections.push(enrichedSection);
      }

      // Build parent relationships within this file
      buildParentRelationships(fileSections);

      // Add to global sections list
      allSections.push(...fileSections);
    }

    console.log(`Generated ${allSections.length} content sections`);

    // Load navigation categories
    let categories;
    if (config.navigationConfigPath) {
      categories = await loadNavigationCategories(config.navigationConfigPath);
    } else {
      // Try default path, will return empty array if not found
      categories = await loadNavigationCategories();
    }

    // Write all output files
    await writeCompilationOutput(config.outputDir, allSections, categories);

    console.log(`${config.name} compilation completed successfully!`);
    console.log(`- ${allSections.length} sections compiled`);
    console.log(`- Navigation tree generated`);
    console.log(`- Index file created`);
    console.log(`- Output written to ${config.outputDir}/`);
  } catch (error) {
    console.error(`Error during ${config.name} compilation:`, error);
    throw error;
  }
}
