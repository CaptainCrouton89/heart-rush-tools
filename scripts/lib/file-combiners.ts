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
  /** Optional nested subdirectories for deeper structures */
  subdirectories?: SubdirectoryConfig[];
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
      { sourceDir: "overview", outputName: "Overview", introFile: "_intro.md" },
      {
        sourceDir: "clueanda",
        outputName: "Clueanda",
        introFile: "_intro.md",
        subdirectories: [
          { sourceDir: "../middle_sea", introFile: "_intro.md" },
          { sourceDir: "../kharvorn_mountains", introFile: "_intro.md" },
          { sourceDir: "../westwilds", introFile: "_intro.md" },
          { sourceDir: "../frostmarch_peninsula", introFile: "_intro.md" },
          { sourceDir: "../celedrim_plains", introFile: "_intro.md" },
          { sourceDir: "../northlands", introFile: "_intro.md" },
          { sourceDir: "../northern_isles", introFile: "_intro.md" },
        ],
      },
      { sourceDir: "western_isles", outputName: "Western_Isles", introFile: "_intro.md" },
      {
        sourceDir: "rimihuica",
        outputName: "Rimihuica",
        introFile: "_intro.md",
        subdirectories: [
          { sourceDir: "../tarkhon", introFile: "_intro.md" },
          { sourceDir: "../westrim", introFile: "_intro.md" },
          { sourceDir: "../innerrim", introFile: "_intro.md" },
          { sourceDir: "../emerald_coast", introFile: "_intro.md" },
          { sourceDir: "../shacklands", introFile: "_intro.md" },
        ],
      },
      {
        sourceDir: "upoceax",
        outputName: "Upoceax",
        introFile: "_intro.md",
        subdirectories: [
          { sourceDir: "../seacliff_coast", introFile: "_intro.md" },
          { sourceDir: "../farlands", introFile: "_intro.md" },
          { sourceDir: "../sandreach", introFile: "_intro.md" },
          { sourceDir: "../free_isles", introFile: "_intro.md" },
          { sourceDir: "../sandreach_mountains", introFile: "_intro.md" },
          { sourceDir: "../giant_lands", introFile: "_intro.md" },
          { sourceDir: "../wycendeula", introFile: "_intro.md" },
          { sourceDir: "../venalthier", introFile: "_intro.md" },
        ],
      },
      { sourceDir: "greenwater_isles", outputName: "Greenwater_Isles", introFile: "_intro.md" },
      {
        sourceDir: "aboyinzu",
        outputName: "Aboyinzu",
        introFile: "_intro.md",
        subdirectories: [
          { sourceDir: "../terrenia", introFile: "_intro.md" },
          { sourceDir: "../central_aboyinzu", introFile: "_intro.md" },
          { sourceDir: "../wanderlands", introFile: "_intro.md" },
          { sourceDir: "../elder_wilds", introFile: "_intro.md" },
          { sourceDir: "../dalizi", introFile: "_intro.md" },
          { sourceDir: "../dragons_spine_coast", introFile: "_intro.md" },
          { sourceDir: "../crimson_coast", introFile: "_intro.md" },
        ],
      },
      {
        sourceDir: "ve",
        outputName: "Ve",
        introFile: "_intro.md",
        subdirectories: [
          { sourceDir: "../alrock_ocean", introFile: "_intro.md" },
        ],
      },
      { sourceDir: "underrealms", outputName: "Underrealms" },
      { sourceDir: "zylogmus_eternus", outputName: "Zylogmus_Eternus" },
    ],
  },
  {
    sourceDir: "world-wikis/alaria/nations_and_powers",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "Nations_&_Powers",
    subdirectories: [
      { sourceDir: "states", outputName: "States", introFile: "_intro.md" },
      { sourceDir: "city_states", outputName: "City_States" },
      { sourceDir: "factions", outputName: "Factions", introFile: "_intro.md" },
      { sourceDir: "daemons", outputName: "Daemons", introFile: "_intro.md" },
    ],
  },
  {
    sourceDir: "world-wikis/alaria/cosmology_and_religion",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "Cosmology_&_Religion",
    subdirectories: [
      {
        sourceDir: "alarian_planar_stack",
        outputName: "Alarian_Planar_Stack",
        introFile: "_intro.md",
        subdirectories: [{ sourceDir: "planes", outputName: "Planes" }],
      },
      { sourceDir: "life_death", outputName: "Life_&_Death" },
      {
        sourceDir: "beyond_alaria",
        outputName: "Beyond_Alaria",
        subdirectories: [
          { sourceDir: "other_planar_stacks", outputName: "Other_Planar_Stacks" },
        ],
      },
    ],
  },
  {
    sourceDir: "world-wikis/alaria/history_and_lore",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "History_&_Lore",
    subdirectories: [
      { sourceDir: "events", outputName: "Events" },
      { sourceDir: "timelines", outputName: "Timelines" },
      { sourceDir: "dramatis_personae", outputName: "Dramatis_Personae" },
      { sourceDir: "artifacts", outputName: "Artifacts" },
    ],
  },
  {
    sourceDir: "world-wikis/alaria/magic_and_knowledge",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "Magic_&_Knowledge",
    subdirectories: [
      { sourceDir: "deoric", outputName: "Deoric" },
      { sourceDir: "faesong", outputName: "Faesong" },
      { sourceDir: "gaeic_melodies", outputName: "Gaeic_Melodies" },
      { sourceDir: "psy_magic", outputName: "Psy_Magic" },
      { sourceDir: "elemental_magic", outputName: "Elemental_Magic", introFile: "_intro.md" },
      { sourceDir: "schools", outputName: "Schools" },
      { sourceDir: "languages", outputName: "Languages" },
      { sourceDir: "materials", outputName: "Materials" },
    ],
  },
  {
    sourceDir: "world-wikis/alaria/bestiary",
    outputDir: "world-wikis/alaria/all_sections_formatted",
    outputName: "Bestiary",
    subdirectories: [
      { sourceDir: "dragons", outputName: "Dragons" },
      { sourceDir: "diseases", outputName: "Diseases" },
    ],
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
 * Converts a filename or directory segment to a display title
 */
function filenameToTitle(filename: string): string {
  const base = filename
    .replace(/\.md$/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (base.length === 0) return "";

  return base.replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveDisplayTitle(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const base = normalized.substring(normalized.lastIndexOf("/") + 1);
  return filenameToTitle(base);
}

const MAX_HEADING_LEVEL = 6;

function clampHeadingLevel(level: number): number {
  return Math.min(MAX_HEADING_LEVEL, Math.max(1, level));
}

function splitFrontMatter(content: string): { frontMatter?: string; body: string } {
  const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/); // YAML frontmatter
  if (frontMatterMatch) {
    const frontMatter = frontMatterMatch[0].trim();
    const body = content.slice(frontMatterMatch[0].length).trimStart();
    return { frontMatter, body };
  }
  return { body: content };
}

function normalizeMarkdownHeadings(content: string, targetLevel: number, fallbackTitle?: string): string {
  const clampedTarget = clampHeadingLevel(targetLevel);
  const { frontMatter, body } = splitFrontMatter(content);
  const lines = body.split(/\r?\n/);
  let firstHeadingIndex = -1;
  let firstHeadingLevel = 0;
  let inCodeBlock = false;

  const headingRegex = /^(#{1,6})\s+(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = headingRegex.exec(line);
    if (match) {
      firstHeadingIndex = i;
      firstHeadingLevel = match[1].length;
      break;
    }
  }

  const adjustment = firstHeadingIndex === -1 ? 0 : clampedTarget - firstHeadingLevel;

  if (firstHeadingIndex !== -1 && adjustment !== 0) {
    inCodeBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;

      const match = headingRegex.exec(line);
      if (match) {
        const currentLevel = match[1].length;
        const newLevel = clampHeadingLevel(currentLevel + adjustment);
        lines[i] = `${"#".repeat(newLevel)} ${match[2]}`;
      }
    }
  }

  let normalizedBody = lines.join("\n").trim();

  if (firstHeadingIndex === -1 && fallbackTitle) {
    const heading = `${"#".repeat(clampedTarget)} ${fallbackTitle}`;
    normalizedBody = normalizedBody.length > 0 ? `${heading}\n\n${normalizedBody}` : heading;
  }

  if (frontMatter) {
    return `${frontMatter}\n${normalizedBody}`.trim();
  }
  return normalizedBody;
}

/**
 * Combines files from a directory into content string using automatic heading normalization
 */
async function combineDirectoryFiles(
  sourceDir: string,
  targetHeadingLevel: number
): Promise<{ content: string; count: number }> {
  const files = await collectMarkdownFiles(sourceDir);

  if (files.length === 0) {
    return { content: "", count: 0 };
  }

  const sections: string[] = [];
  const clampedTarget = clampHeadingLevel(targetHeadingLevel);

  for (const filename of files) {
    const filePath = path.join(sourceDir, filename);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const normalized = normalizeMarkdownHeadings(fileContent, clampedTarget, filenameToTitle(filename));
    sections.push(normalized.trim());
  }

  return {
    content: sections.join("\n\n"),
    count: files.length,
  };
}

interface BuildNodeOptions {
  dirPath: string;
  depth: number;
  outputDir: string;
  name: string;
  introFile?: string;
  subdirectories?: SubdirectoryConfig[];
  inline: boolean;
}

interface DirectoryBodyOptions {
  dirPath: string;
  depth: number;
  outputDir: string;
  subdirectories?: SubdirectoryConfig[];
}

async function buildDirectoryBody(options: DirectoryBodyOptions): Promise<{ content: string; count: number }> {
  const { dirPath, depth, outputDir, subdirectories } = options;
  const sections: string[] = [];
  let totalCount = 0;

  if (subdirectories) {
    for (const subdir of subdirectories) {
      const subdirPath = path.join(dirPath, subdir.sourceDir);

      if (subdir.outputName) {
        // Creates separate output file - don't count toward parent
        await buildNode({
          dirPath: subdirPath,
          depth: 0,
          outputDir,
          name: subdir.outputName,
          introFile: subdir.introFile,
          subdirectories: subdir.subdirectories,
          inline: false,
        });
      } else {
        const childDepth = subdir.headerLevelAdjust !== undefined
          ? Math.max(0, depth + subdir.headerLevelAdjust)
          : depth + 1;

        const { content, count } = await buildNode({
          dirPath: subdirPath,
          depth: childDepth,
          outputDir,
          name: subdir.sourceDir,
          introFile: subdir.introFile,
          subdirectories: subdir.subdirectories,
          inline: true,
        });

        if (content.trim()) {
          sections.push(content.trim());
        }
        totalCount += count;
      }
    }
  }

  const { content: fileContent, count: fileCount } = await combineDirectoryFiles(dirPath, depth + 2);
  if (fileContent.trim()) {
    sections.push(fileContent.trim());
  }
  totalCount += fileCount;

  return {
    content: sections.join("\n\n"),
    count: totalCount,
  };
}

async function buildNode(options: BuildNodeOptions): Promise<{ content: string; count: number }> {
  const { dirPath, depth, outputDir, name, introFile, subdirectories, inline } = options;
  const displayTitle = deriveDisplayTitle(name);
  const headingLevel = inline ? clampHeadingLevel(depth + 1) : 1;
  const sections: string[] = [];

  if (introFile) {
    const introPath = path.join(dirPath, introFile);
    const introContent = await readIntroFile(introPath);
    sections.push(normalizeMarkdownHeadings(introContent, headingLevel, displayTitle));
  } else if (!inline) {
    sections.push(`# ${displayTitle}`);
  } else {
    sections.push(`${"#".repeat(headingLevel)} ${displayTitle}`);
  }

  const { content: bodyContent, count } = await buildDirectoryBody({
    dirPath,
    depth,
    outputDir,
    subdirectories,
  });

  if (bodyContent.trim()) {
    sections.push(bodyContent.trim());
  }

  const combined = sections.filter((section) => section.trim().length > 0).join("\n\n");

  if (!inline) {
    // Skip writing empty parent files (just a header with no content)
    // Only write if: has an intro file, has body content, or has files combined into it
    const hasRealContent = introFile || bodyContent.trim() || count > 0;
    if (hasRealContent) {
      const outputPath = path.join(outputDir, `${name}.md`);
      await fs.writeFile(outputPath, combined.trim());
      if (count > 0) {
        console.log(`  ✅ Combined ${count} files into ${name}.md`);
      }
    }
    return { content: "", count };
  }

  return { content: combined, count };
}

/**
 * Generic config-driven combiner function.
 * Processes a CombinerConfig and creates the combined super-document.
 */
async function combineFromConfig(config: CombinerConfig): Promise<number> {
  await fs.mkdir(config.outputDir, { recursive: true });

  const { count } = await buildNode({
    dirPath: config.sourceDir,
    depth: 0,
    outputDir: config.outputDir,
    name: config.outputName,
    introFile: config.introFile,
    subdirectories: config.subdirectories,
    inline: false,
  });

  return count;
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
 * Cleans generated .md files from an output directory before recompiling.
 * Preserves special files like CLAUDE.md.
 */
async function cleanOutputDirectory(outputDir: string): Promise<void> {
  const preserveFiles = new Set(["CLAUDE.md", ".claude-md-manager.md"]);

  const entries = await fs.readdir(outputDir, { withFileTypes: true }).catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") return [];
    throw err;
  });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md") && !preserveFiles.has(entry.name)) {
      await fs.unlink(path.join(outputDir, entry.name));
    }
  }
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

  // Clean output directory before combining to remove stale files
  const outputDir = "world-wikis/alaria/all_sections_formatted";
  await cleanOutputDirectory(outputDir);

  // Process each category using the unified combiner
  for (const config of ALARIA_COMBINERS) {
    await combineFromConfig(config);
  }

  console.log("✅ Alaria file combination complete");
}
