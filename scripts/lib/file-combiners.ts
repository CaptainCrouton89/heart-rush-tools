import fs from "fs/promises";
import path from "path";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration for a subdirectory within a combiner.
 * Can either be merged into parent document or become its own super-document.
 */
interface SubdirectoryConfig {
  /** Directory name relative to parent sourceDir */
  sourceDir: string;
  /** If provided, creates separate super-document. If omitted, merges into parent. */
  outputName?: string;
  /** Path to intro file (relative to subdirectory). Required if merging into parent. */
  introFile?: string;
  /** Header level adjustment for files in this directory (e.g., 1 means ## becomes ###) */
  headerLevelAdjust?: number;
}

/**
 * Configuration for combining files into a super-document.
 * Works for both Heart Rush content and world wikis.
 */
interface CombinerConfig {
  /** Source directory containing files to combine */
  sourceDir: string;
  /** Output directory for the combined super-document */
  outputDir: string;
  /** Output filename (without .md extension) */
  outputName: string;
  /** Path to intro file (relative to sourceDir). If omitted, generates header from outputName. */
  introFile?: string;
  /** Subdirectories to process */
  subdirectories?: SubdirectoryConfig[];
}

// =============================================================================
// HEART RUSH CONFIGURATION
// =============================================================================

const HEART_RUSH_COMBINERS: CombinerConfig[] = [
  {
    sourceDir: "heart_rush/races",
    outputDir: "heart_rush/all_sections_formatted",
    outputName: "Kin_&_Culture",
    introFile: "_intro.md",
  },
  {
    sourceDir: "heart_rush/talents",
    outputDir: "heart_rush/all_sections_formatted",
    outputName: "Talents",
    introFile: "_intro.md",
    subdirectories: [
      // Combat talents merge into parent, no separate intro (already in main _intro.md)
      { sourceDir: "combat_talents", headerLevelAdjust: 1 },
      // Noncombat talents merge into parent with their own intro
      { sourceDir: "noncombat_talents", introFile: "_intro.md", headerLevelAdjust: 1 },
      // Spells (elemental talents) merge into parent with their own intro
      { sourceDir: "spells", introFile: "_intro.md", headerLevelAdjust: 1 },
    ],
  },
];

// =============================================================================
// ALARIA CONFIGURATION
// =============================================================================

const ALARIA_COMBINERS: CombinerConfig[] = [
  {
    sourceDir: "world-wikis/alaria/atlas_of_alaria",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "Atlas_of_Alaria",
    subdirectories: [
      // Regional subdirectories - each becomes its own super-document
      { sourceDir: "northlands", outputName: "Northlands" },
      { sourceDir: "celedrim_plains", outputName: "Celedrim_Plains" },
      { sourceDir: "northern_isles", outputName: "Northern_Isles" },
      { sourceDir: "frostmarch_peninsula", outputName: "Frostmarch_Peninsula" },
      { sourceDir: "kharvorn_mountains", outputName: "Kharvorn_Mountains" },
      { sourceDir: "westwilds", outputName: "Westwilds" },
      { sourceDir: "western_isles", outputName: "Western_Isles" },
      { sourceDir: "seacliff_coast", outputName: "Seacliff_Coast" },
      { sourceDir: "greenwater_isles", outputName: "Greenwater_Isles" },
      { sourceDir: "tarkhon", outputName: "Tarkhon" },
      { sourceDir: "westrim", outputName: "Westrim" },
      { sourceDir: "middle_sea", outputName: "Middle_Sea" },
      { sourceDir: "emerald_coast", outputName: "Emerald_Coast" },
      { sourceDir: "sandreach", outputName: "Sandreach" },
      { sourceDir: "sandreach_mountains", outputName: "Sandreach_Mountains" },
      { sourceDir: "shacklands", outputName: "Shacklands" },
      { sourceDir: "terrenia", outputName: "Terrenia" },
      { sourceDir: "central_aboyinzu", outputName: "Central_Aboyinzu" },
      { sourceDir: "elder_wilds", outputName: "Elder_Wilds" },
      { sourceDir: "dalizi", outputName: "Dalizi" },
      { sourceDir: "sea_of_daggers", outputName: "Sea_of_Daggers" },
      { sourceDir: "azel_spine_coast", outputName: "Azel_Spine_Coast" },
      { sourceDir: "venalthier", outputName: "Venalthier" },
      { sourceDir: "dawnbreak", outputName: "Dawnbreak" },
      { sourceDir: "ve", outputName: "Ve" },
    ],
  },
  {
    sourceDir: "world-wikis/alaria/nations_and_powers",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "Nations_&_Powers",
  },
  {
    sourceDir: "world-wikis/alaria/cosmology_and_religion",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "Cosmology_&_Religion",
    subdirectories: [
      // Daemons become their own separate super-document
      { sourceDir: "daemons", outputName: "Daemons" },
    ],
  },
  {
    sourceDir: "world-wikis/alaria/history_and_lore",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "History_&_Lore",
  },
  {
    sourceDir: "world-wikis/alaria/magic_and_knowledge",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "Magic_&_Knowledge",
  },
  {
    sourceDir: "world-wikis/alaria/bestiary",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "Bestiary",
    subdirectories: [
      // Dragons become their own separate super-document
      { sourceDir: "dragons", outputName: "Dragons" },
    ],
  },
  {
    sourceDir: "world-wikis/alaria/dramatis_personae",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "Dramatis_Personae",
  },
];

/**
 * Reads an intro file and returns its content.
 * Throws an error if the file is missing (fail-fast behavior).
 */
async function readIntroFile(introPath: string): Promise<string> {
  const content = await fs.readFile(introPath, "utf-8").catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") {
      throw new Error(`Required intro file not found: ${introPath}`);
    }
    throw err;
  });
  return content.trim();
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Collects markdown files from a directory (non-recursive, excludes special files)
 */
async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const markdownFiles: string[] = [];

  const entries = await fs.readdir(dir, { withFileTypes: true }).catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  });

  for (const entry of entries) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      entry.name !== "CLAUDE.md" &&
      entry.name !== ".claude-md-manager.md" &&
      entry.name !== "_intro.md"
    ) {
      markdownFiles.push(entry.name);
    }
  }

  return markdownFiles.sort();
}

/**
 * Converts a filename to a display title
 */
function filenameToTitle(filename: string): string {
  return filename.replace(/\.md$/, "").replace(/_/g, " ");
}

/**
 * Adjusts header levels in markdown content
 * e.g., headerLevelAdjust=1 converts ## to ###
 */
function adjustHeaderLevels(content: string, adjustment: number): string {
  if (adjustment === 0) return content;
  const prefix = "#".repeat(adjustment);
  return content.replace(/^(#+)/gm, `$1${prefix}`);
}

/**
 * Combines files from a directory into content string
 */
async function combineDirectoryFiles(
  sourceDir: string,
  headerLevelAdjust: number = 0
): Promise<{ content: string; count: number }> {
  const files = await collectMarkdownFiles(sourceDir);

  if (files.length === 0) {
    return { content: "", count: 0 };
  }

  let content = "";

  for (const filename of files) {
    const filePath = path.join(sourceDir, filename);
    let fileContent = await fs.readFile(filePath, "utf-8");

    // Check if file already has proper header structure
    const startsWithH2 = /^##\s+/.test(fileContent.trim());

    if (startsWithH2) {
      // Adjust header levels if needed
      fileContent = adjustHeaderLevels(fileContent, headerLevelAdjust);
      content += fileContent.trim() + "\n\n";
    } else {
      // Generate header from filename
      const title = filenameToTitle(filename);
      const headerLevel = 2 + headerLevelAdjust;
      content += `${"#".repeat(headerLevel)} ${title}\n\n`;
      content += fileContent.trim() + "\n\n";
    }
  }

  return { content, count: files.length };
}

/**
 * Generic config-driven combiner function.
 * Processes a CombinerConfig and creates the combined super-document.
 */
async function combineFromConfig(config: CombinerConfig): Promise<number> {
  // Ensure output directory exists
  await fs.mkdir(config.outputDir, { recursive: true });

  let combinedContent = "";
  let totalFiles = 0;
  const separateDocuments: Array<{ name: string; count: number }> = [];

  // Start with intro file if specified, otherwise generate header
  if (config.introFile) {
    const introPath = path.join(config.sourceDir, config.introFile);
    combinedContent = await readIntroFile(introPath) + "\n\n";
  } else {
    const title = config.outputName.replace(/_/g, " ").replace(/&/g, "&");
    combinedContent = `# ${title}\n\n`;
  }

  // Process subdirectories first
  if (config.subdirectories) {
    for (const subdir of config.subdirectories) {
      const subdirPath = path.join(config.sourceDir, subdir.sourceDir);

      if (subdir.outputName) {
        // Subdirectory becomes its own separate super-document
        const subdirOutputPath = path.join(config.outputDir, `${subdir.outputName}.md`);
        const title = subdir.outputName.replace(/_/g, " ").replace(/&/g, "&");

        let subdirContent = "";
        if (subdir.introFile) {
          const introPath = path.join(subdirPath, subdir.introFile);
          subdirContent = await readIntroFile(introPath) + "\n\n";
        } else {
          subdirContent = `# ${title}\n\n`;
        }

        const { content, count } = await combineDirectoryFiles(subdirPath, 0);
        if (count > 0) {
          subdirContent += content;
          await fs.writeFile(subdirOutputPath, subdirContent.trim());
          separateDocuments.push({ name: subdir.outputName, count });
        }
      } else {
        // Subdirectory merges into parent document
        if (subdir.introFile) {
          const introPath = path.join(subdirPath, subdir.introFile);
          combinedContent += await readIntroFile(introPath) + "\n\n";
        }

        const { content, count } = await combineDirectoryFiles(
          subdirPath,
          subdir.headerLevelAdjust ?? 0
        );
        combinedContent += content;
        totalFiles += count;
      }
    }
  }

  // Process top-level files in source directory
  const { content, count } = await combineDirectoryFiles(config.sourceDir, 0);
  combinedContent += content;
  totalFiles += count;

  // Write the main combined document
  const outputPath = path.join(config.outputDir, `${config.outputName}.md`);
  await fs.writeFile(outputPath, combinedContent.trim());

  // Log results
  for (const doc of separateDocuments) {
    console.log(`  ✅ Combined ${doc.count} files into ${doc.name}.md`);
  }
  if (totalFiles > 0) {
    console.log(`  ✅ Combined ${totalFiles} files into ${config.outputName}.md`);
  }

  return totalFiles + separateDocuments.reduce((sum, d) => sum + d.count, 0);
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * Combines Heart Rush race files into Kin_&_Culture.md
 */
export async function combineRaceFiles(): Promise<void> {
  console.log("Combining race files into Kin_&_Culture.md...");
  await combineFromConfig(HEART_RUSH_COMBINERS[0]);
}

/**
 * Combines Heart Rush talent files into Talents.md
 */
export async function combineTalentFiles(): Promise<void> {
  console.log("Combining talent files into Talents.md...");
  await combineFromConfig(HEART_RUSH_COMBINERS[1]);
}

/**
 * Combines all Alaria world wiki files into super-documents in all_sections_formatted/
 */
export async function combineAlariaFiles(): Promise<void> {
  console.log("Combining Alaria world wiki files...");

  // Check if Alaria directory exists
  const alariaDir = "world-wikis/alaria";
  await fs.access(alariaDir).catch(() => {
    console.log("  Alaria world directory not found, skipping");
    return;
  });

  // Process each category using the unified combiner
  for (const config of ALARIA_COMBINERS) {
    await combineFromConfig(config);
  }

  console.log("✅ Alaria file combination complete");
}
