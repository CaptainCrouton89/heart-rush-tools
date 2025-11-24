#!/usr/bin/env tsx
import fs from "fs/promises";
import matter from "gray-matter";
import path from "path";

// Import helper modules
import { ContentSection } from "./lib/types.js";
import { 
  generateSlug, 
  countWords, 
  calculateReadingTime, 
  extractTags, 
  extractCrossReferences 
} from "./lib/utils.js";
import { combineRaceFiles, combineTalentFiles } from "./lib/file-combiners.js";
import { splitContent } from "./lib/content-processors.js";
import { loadNavigationCategories, createCategorizedNavigation } from "./lib/navigation-builder.js";
import { copyRaceImages, findRaceImage } from "./lib/image-handler.js";

const SOURCE_DIR = "heart_rush/all_sections_formatted";
const GM_SOURCE_DIR = "heart_rush/gm_guide";
const OUTPUT_DIR = "content";
const GM_OUTPUT_DIR = "content/gm";
const GM_CATEGORIES_CONFIG_PATH = "gm-navigation-categories.json";

async function compilePlayerContent(): Promise<void> {
  console.log("Starting player content compilation...");

  try {
    // First, combine race files into Kin_&_Culture.md
    await combineRaceFiles();

    // Combine talent files into Talents.md
    await combineTalentFiles();

    // Copy race images to public directory
    await copyRaceImages();

    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Read source files
    const sourceFiles = await fs.readdir(SOURCE_DIR);
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

      // Keep track of sections from current file for proper parent relationships
      const fileSections: ContentSection[] = [];

      // Process each section
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const wordCount = countWords(section.content);
        const readingTime = calculateReadingTime(wordCount);

        // Check for race image if this is from Kin & Culture category
        let image: string | undefined;
        if (category === "Kin & Culture") {
          image = await findRaceImage(section.title);
        }

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
          ...(image && { image }),
        };

        // Set parent relationship for subsections - only look within current file
        if (section.level > 1 && fileSections.length > 0) {
          // Find the most recent section with a lower level within current file
          // Prefer exactly one level lower, but fall back to any lower level if needed
          let bestParent = null;

          for (let j = fileSections.length - 1; j >= 0; j--) {
            const candidateParent = fileSections[j];
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
            contentSection.parent = bestParent.slug;
          }
        }

        fileSections.push(contentSection);
        allSections.push(contentSection);
      }
    }

    console.log(`Generated ${allSections.length} content sections`);

    // Write individual section files
    for (const section of allSections) {
      const sectionPath = path.join(OUTPUT_DIR, `${section.slug}.json`);
      await fs.writeFile(sectionPath, JSON.stringify(section, null, 2));
    }

    // Load navigation categories and generate categorized navigation
    const categories = await loadNavigationCategories();
    const categorizedNavigation = createCategorizedNavigation(
      allSections,
      categories
    );

    // Write categorized navigation file
    await fs.writeFile(
      path.join(OUTPUT_DIR, "navigation.json"),
      JSON.stringify(categorizedNavigation, null, 2)
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
      ...(section.image && { image: section.image }),
    }));

    await fs.writeFile(
      path.join(OUTPUT_DIR, "index.json"),
      JSON.stringify(index, null, 2)
    );

    console.log("Player content compilation completed successfully!");
    console.log(`- ${allSections.length} sections compiled`);
    console.log(`- Navigation tree generated`);
    console.log(`- Index file created`);
    console.log(`- Output written to ${OUTPUT_DIR}/`);
  } catch (error) {
    console.error("Error during player content compilation:", error);
    process.exit(1);
  }
}

async function compileGMContent(): Promise<void> {
  console.log("Starting GM content compilation...");

  try {
    // Ensure GM output directory exists
    await fs.mkdir(GM_OUTPUT_DIR, { recursive: true });

    // Read all markdown files from GM source directory
    const files = await fs.readdir(GM_SOURCE_DIR);
    const markdownFiles = files.filter(
      (file) => file.endsWith(".md") && file !== "CLAUDE.md" && file !== ".claude-md-manager.md"
    );

    const allSections: ContentSection[] = [];
    const existingSlugs = new Set<string>();
    let globalOrder = 1;

    for (const filename of markdownFiles) {
      const filePath = path.join(GM_SOURCE_DIR, filename);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const { data: frontMatter, content } = matter(fileContent);

      // Extract category from frontmatter or derive from filename
      const category =
        frontMatter.category ||
        filename.replace(/\.md$/, "").replace(/_/g, " ");

      // Split content into sections
      const sections = splitContent(content, filename);

      // Keep track of sections from current file for proper parent relationships
      const fileSections: ContentSection[] = [];

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

        // Set parent relationship for subsections - only look within current file
        if (section.level > 1 && fileSections.length > 0) {
          let bestParent = null;

          for (let j = fileSections.length - 1; j >= 0; j--) {
            const candidateParent = fileSections[j];
            if (candidateParent.level < section.level) {
              if (candidateParent.level === section.level - 1) {
                bestParent = candidateParent;
                break;
              }
              if (!bestParent) {
                bestParent = candidateParent;
              }
            }
          }

          if (bestParent) {
            contentSection.parent = bestParent.slug;
          }
        }

        fileSections.push(contentSection);
        allSections.push(contentSection);
      }
    }

    console.log(`Generated ${allSections.length} GM content sections`);

    // Write individual section files
    for (const section of allSections) {
      const sectionPath = path.join(GM_OUTPUT_DIR, `${section.slug}.json`);
      await fs.writeFile(sectionPath, JSON.stringify(section, null, 2));
    }

    // Load GM navigation categories and generate categorized navigation
    const gmCategories = await loadNavigationCategories(
      GM_CATEGORIES_CONFIG_PATH
    );
    const categorizedNavigation = createCategorizedNavigation(
      allSections,
      gmCategories
    );

    // Write categorized navigation file
    await fs.writeFile(
      path.join(GM_OUTPUT_DIR, "navigation.json"),
      JSON.stringify(categorizedNavigation, null, 2)
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
      path.join(GM_OUTPUT_DIR, "index.json"),
      JSON.stringify(index, null, 2)
    );

    console.log("GM content compilation completed successfully!");
    console.log(`- ${allSections.length} GM sections compiled`);
    console.log(`- GM navigation tree generated`);
    console.log(`- GM index file created`);
    console.log(`- Output written to ${GM_OUTPUT_DIR}/`);
  } catch (error) {
    console.error("Error during GM content compilation:", error);
    process.exit(1);
  }
}

async function compileContent(): Promise<void> {
  try {
    // Compile both player and GM content
    await compilePlayerContent();

    // Check if GM content directory exists before compiling
    try {
      await fs.access(GM_SOURCE_DIR);
      await compileGMContent();
    } catch {
      console.log(
        "No GM guide directory found, skipping GM content compilation"
      );
    }

    console.log("\n🎉 All content compilation completed successfully!");
  } catch (error) {
    console.error("Error during content compilation:", error);
    process.exit(1);
  }
}

// Run the compilation
compileContent().catch(console.error);
