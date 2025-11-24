#!/usr/bin/env tsx
import fs from "fs/promises";
import path from "path";

// Import helper modules
import { ContentSection, CompilationConfig } from "./lib/types.js";
import { combineRaceFiles, combineTalentFiles, combineAlariaFiles } from "./lib/file-combiners.js";
import { compileContentPipeline } from "./lib/content-processors.js";
import { copyRaceImages, findRaceImage } from "./lib/image-handler.js";

const SOURCE_DIR = "heart_rush/all_sections_formatted";
const GM_SOURCE_DIR = "heart_rush/gm_guide";
const WORLDS_SOURCE_DIR = "world-wikis";
const OUTPUT_DIR = "content";
const GM_OUTPUT_DIR = "content/gm";
const WORLDS_OUTPUT_DIR = "content/worlds";
const GM_CATEGORIES_CONFIG_PATH = "gm-navigation-categories.json";


async function compilePlayerContent(): Promise<void> {
  try {
    // First, combine race files into Kin_&_Culture.md
    await combineRaceFiles();

    // Combine talent files into Talents.md
    await combineTalentFiles();

    // Copy race images to public directory
    await copyRaceImages();

    // Configure and run compilation pipeline
    const config: CompilationConfig = {
      name: "player content",
      sourceDir: SOURCE_DIR,
      outputDir: OUTPUT_DIR,
      enrichSection: async (section: ContentSection, filename: string) => {
        // Check for race image if this is from Kin & Culture category
        if (section.category === "Kin & Culture") {
          const image = await findRaceImage(section.title);
          if (image) {
            return { ...section, image };
          }
        }
        return section;
      },
    };

    await compileContentPipeline(config);
  } catch (error) {
    console.error("Error during player content compilation:", error);
    process.exit(1);
  }
}

async function compileGMContent(): Promise<void> {
  try {
    const config: CompilationConfig = {
      name: "GM content",
      sourceDir: GM_SOURCE_DIR,
      outputDir: GM_OUTPUT_DIR,
      navigationConfigPath: GM_CATEGORIES_CONFIG_PATH,
    };

    await compileContentPipeline(config);
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

    // Read markdown files to check if there are any
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

    // Check for world-specific navigation config
    const worldCategoriesPath = path.join(worldSourceDir, "navigation-categories.json");
    let navigationConfigPath: string | undefined;
    try {
      await fs.access(worldCategoriesPath);
      navigationConfigPath = worldCategoriesPath;
    } catch {
      // No custom categories - will use empty array fallback
      navigationConfigPath = undefined;
    }

    const config: CompilationConfig = {
      name: `${worldName} world wiki`,
      sourceDir: allSectionsDir,
      outputDir: worldOutputDir,
      navigationConfigPath,
    };

    await compileContentPipeline(config);

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
