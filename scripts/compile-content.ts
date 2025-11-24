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
import { combineRaceFiles, combineTalentFiles, combineAlariaFiles } from "./lib/file-combiners.js";
import { splitContent } from "./lib/content-processors.js";
import { loadNavigationCategories, createCategorizedNavigation } from "./lib/navigation-builder.js";
import { copyRaceImages, findRaceImage } from "./lib/image-handler.js";

const SOURCE_DIR = "heart_rush/all_sections_formatted";
const GM_SOURCE_DIR = "heart_rush/gm_guide";
const WORLDS_SOURCE_DIR = "world-wikis";
const OUTPUT_DIR = "content";
const GM_OUTPUT_DIR = "content/gm";
const WORLDS_OUTPUT_DIR = "content/worlds";
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

async function compileWorldWiki(worldName: string): Promise<void> {
  console.log(`\nCompiling world wiki: ${worldName}...`);

  try {
    const worldSourceDir = path.join(WORLDS_SOURCE_DIR, worldName);
    const allSectionsDir = path.join(worldSourceDir, "all_sections_formatted");
    const worldOutputDir = path.join(WORLDS_OUTPUT_DIR, worldName);

    // Check if all_sections_formatted exists
    try {
      await fs.access(allSectionsDir);
    } catch {
      console.log(`  ⚠️  No all_sections_formatted directory in ${worldName}, skipping`);
      return;
    }

    // Read markdown files from all_sections_formatted
    const sourceFiles = await fs.readdir(allSectionsDir);
    const markdownFiles = sourceFiles.filter(
      (file) => file.endsWith(".md") && file !== "CLAUDE.md" && file !== ".claude-md-manager.md"
    );

    if (markdownFiles.length === 0) {
      console.log(`  ⚠️  No markdown files found in ${worldName}/all_sections_formatted, skipping`);
      return;
    }

    // Create output directory
    await fs.rm(worldOutputDir, { recursive: true, force: true });
    await fs.mkdir(worldOutputDir, { recursive: true });

    console.log(`  Found ${markdownFiles.length} markdown files to process`);

    const allSections: ContentSection[] = [];
    const existingSlugs = new Set<string>();
    let globalOrder = 0;

    // Process each file (same pattern as Heart Rush player content)
    for (const filename of markdownFiles.sort()) {
      const filePath = path.join(allSectionsDir, filename);
      const fileContent = await fs.readFile(filePath, "utf-8");

      // Parse frontmatter
      const { content } = matter(fileContent);

      // Determine category from filename
      const category = filename
        .replace(/\.md$/, "")
        .replace(/_/g, " ")
        .replace(/&/g, " & ");

      // Split content into sections
      const sections = splitContent(content, filename);

      const fileSections: ContentSection[] = [];

      // Process each section
      for (const section of sections) {
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

    console.log(`  Generated ${allSections.length} sections`);

    // Write individual section files
    for (const section of allSections) {
      const sectionPath = path.join(worldOutputDir, `${section.slug}.json`);
      await fs.writeFile(sectionPath, JSON.stringify(section, null, 2));
    }

    // Load navigation categories for this world
    let categories;
    const worldCategoriesPath = path.join(worldSourceDir, "navigation-categories.json");
    try {
      await fs.access(worldCategoriesPath);
      categories = await loadNavigationCategories(worldCategoriesPath);
    } catch {
      // No custom categories, auto-generate from content
      const uniqueCategories = Array.from(
        new Set(allSections.map(s => s.category))
      ).map((cat) => ({
        name: cat,
        sections: allSections.filter(s => s.category === cat).map(s => s.slug)
      }));
      categories = uniqueCategories;
    }

    const categorizedNavigation = createCategorizedNavigation(
      allSections,
      categories
    );

    // Write navigation file
    await fs.writeFile(
      path.join(worldOutputDir, "navigation.json"),
      JSON.stringify(categorizedNavigation, null, 2)
    );

    // Write index file
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
      path.join(worldOutputDir, "index.json"),
      JSON.stringify(index, null, 2)
    );

    console.log(`  ✅ ${worldName} compilation complete`);
  } catch (error) {
    console.error(`  ❌ Error compiling ${worldName}:`, error);
    throw error;
  }
}

async function compileAllWorldWikis(): Promise<void> {
  console.log("\nStarting world wikis compilation...");

  try {
    // Check if worlds directory exists
    try {
      await fs.access(WORLDS_SOURCE_DIR);
    } catch {
      console.log("No world-wikis directory found, skipping world wikis compilation");
      return;
    }

    // Combine Alaria files first (like how we combine race/talent files for Heart Rush)
    await combineAlariaFiles();

    // Ensure worlds output directory exists
    await fs.mkdir(WORLDS_OUTPUT_DIR, { recursive: true });

    // Get all world directories
    const entries = await fs.readdir(WORLDS_SOURCE_DIR, { withFileTypes: true });
    const worldDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    if (worldDirs.length === 0) {
      console.log("No world directories found, skipping world wikis compilation");
      return;
    }

    console.log(`Found ${worldDirs.length} world(s): ${worldDirs.join(", ")}`);

    // Compile each world
    for (const worldName of worldDirs) {
      await compileWorldWiki(worldName);
    }

    console.log("\n✅ All world wikis compilation completed!");
  } catch (error) {
    console.error("Error during world wikis compilation:", error);
    throw error;
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

    // Compile world wikis
    await compileAllWorldWikis();

    console.log("\n🎉 All content compilation completed successfully!");
  } catch (error) {
    console.error("Error during content compilation:", error);
    process.exit(1);
  }
}

// Run the compilation
compileContent().catch(console.error);
