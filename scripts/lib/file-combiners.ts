import fs from "fs/promises";
import path from "path";

const SOURCE_DIR = "heart_rush/all_sections_formatted";
const RACES_DIR = "heart_rush/races";
const TALENTS_DIR = "heart_rush/talents";
const COMBAT_TALENTS_DIR = "heart_rush/talents/combat_talents";
const NONCOMBAT_TALENTS_DIR = "heart_rush/talents/noncombat_talents";
const SPELLS_DIR = "heart_rush/talents/spells";
const WORLDS_SOURCE_DIR = "world-wikis";

// World wiki category configurations
// Each category can have subdirectories that become their own super-documents
interface WorldWikiCategoryConfig {
  sourceDir: string;
  outputName: string;
  subdirectories?: {
    sourceDir: string;
    outputName: string;
  }[];
}

const ALARIA_CATEGORIES: WorldWikiCategoryConfig[] = [
  {
    sourceDir: "atlas_of_alaria",
    outputName: "Atlas_of_Alaria",
  },
  {
    sourceDir: "nations_and_powers",
    outputName: "Nations_&_Powers",
  },
  {
    sourceDir: "cosmology_and_religion",
    outputName: "Cosmology_&_Religion",
    subdirectories: [
      { sourceDir: "daemons", outputName: "Daemons" },
    ],
  },
  {
    sourceDir: "history_and_lore",
    outputName: "History_&_Lore",
  },
  {
    sourceDir: "magic_and_knowledge",
    outputName: "Magic_&_Knowledge",
  },
  {
    sourceDir: "bestiary",
    outputName: "Bestiary",
    subdirectories: [
      { sourceDir: "dragons", outputName: "Dragons" },
    ],
  },
  {
    sourceDir: "dramatis_personae",
    outputName: "Dramatis_Personae",
  },
];

export async function combineRaceFiles(): Promise<void> {
  console.log("Combining race files into Kin_&_Culture.md...");

  try {
    // Check if races directory exists
    const racesPath = RACES_DIR;
    try {
      await fs.access(racesPath);
    } catch {
      console.log("No races directory found, skipping race file combination");
      return;
    }

    // Read all race files
    const raceFiles = await fs.readdir(racesPath);
    const raceMarkdownFiles = raceFiles
      .filter((file) => file.endsWith(".md") && file !== "CLAUDE.md" && file !== ".claude-md-manager.md")
      .sort(); // Sort alphabetically for consistent ordering

    if (raceMarkdownFiles.length === 0) {
      console.log("No race files found, skipping race file combination");
      return;
    }

    // Start with the main header
    let combinedContent = "# Kin & Culture\n\n";

    // Read and combine all race files
    for (const filename of raceMarkdownFiles) {
      const racePath = path.join(racesPath, filename);
      const raceContent = await fs.readFile(racePath, "utf-8");

      // Add the race content (which already starts with ##)
      combinedContent += raceContent.trim() + "\n\n";
    }

    // Write the combined file to the source directory
    const outputPath = path.join(SOURCE_DIR, "Kin_&_Culture.md");
    await fs.writeFile(outputPath, combinedContent.trim());

    console.log(
      `✅ Combined ${raceMarkdownFiles.length} race files into Kin_&_Culture.md`
    );
  } catch (error) {
    console.error("Error combining race files:", error);
    throw error;
  }
}

export async function combineTalentFiles(): Promise<void> {
  console.log("Combining talent files into Talents.md...");

  try {
    // Check if talents directory exists
    const talentsPath = TALENTS_DIR;
    try {
      await fs.access(talentsPath);
    } catch {
      console.log(
        "No talents directory found, skipping talent file combination"
      );
      return;
    }

    // Start with the main header and introduction
    let combinedContent = `# Talents

Talents represent specific abilities you have learned, been gifted, or know how to perform through religious or magical ritual. Each talent will fall into one of three types of abilities: passive abilities, heart abilities, or major abilities. As with abilities gained from your class, passive abilities can be used whenever and at no cost, and major abilities can be used once per day. Heart abilities, in contrast, can be used again only after you have taken a short or long rest, or if you take a wound.

Additionally, talents may also have the instant or full action tag. If it is instant, then you can use the ability at literally any time, even right before you roll. If it has the full action tag, it requires you to use your action.

## Types of Talents

Several varieties of talents exist, indicated by their tags. Each require different conditions to be met in order to gain that talent.

### Cognitive and Martial Talents

Martial talents are those that require physical prowess and training. They represent the culmination of extensive practice and training. There are no prerequisites for taking a martial talent.

Cognitive talents, like martial talents, come from vigorous training and practice. Likewise, there are no prerequisites for taking a cognitive talent.

### Gaeic Melodies

Gaeic melodies are fragments of song that reverberate throughout all living things—left over from when Gaea the Earth Mother sang the world into life.

Gaeic melodies are magical, and listening to them have magical effects. However, they cannot be discovered innately, and require a teacher or a songbook. In addition, you must have a rank 3 or higher aspect in musical talents in order to play them.

When playing a gaeic melody, it requires your action to play the instrument. You can move up to half your move speed while playing, but cannot move more than that. You cannot play more than one gaeic melody at the same time.

### Handmagic

Handmagic uses the power of Deoric to create their effects. Deoric is the language of truth—where words spoken in it simply come true.

Handmagic uses Deoric runes tattooed on the back of one's hand, inscribed in the blood of magical creatures to power this life-cost. By articulating the tattooed hand in specific ways, one can then create those magical effects. The knowledge and necessary materials to inscribe hand runes is rare and expensive, and will cost a hefty fee, and likely require you to be in a city.

### Elemental Talents

Elemental talents include passive elemental effects and powerful invocations of elemental power. Each talent will have one or more elemental tags, indicating the element it is associated with, and the attunement(s) required to pick up the talent. Elemental talents are listed in their own section of the talent list. Gaining an elemental talent represents long periods of study, practice, and meditation.

## Combat Talents

The talents in this section are combat-related talents. This categorization is for the ease of finding talents, and has no other effect.

`;

    // Combine combat talents
    try {
      await fs.access(COMBAT_TALENTS_DIR);
      const combatFiles = await fs.readdir(COMBAT_TALENTS_DIR);
      const combatMarkdownFiles = combatFiles
        .filter((file) => file.endsWith(".md") && file !== "CLAUDE.md" && file !== ".claude-md-manager.md")
        .sort(); // Sort alphabetically for consistent ordering

      if (combatMarkdownFiles.length > 0) {
        for (const filename of combatMarkdownFiles) {
          const talentPath = path.join(COMBAT_TALENTS_DIR, filename);
          const talentContent = await fs.readFile(talentPath, "utf-8");

          // Convert ## headers to ### headers for individual talents
          const adjustedContent = talentContent.replace(/^## /gm, "### ");
          combinedContent += adjustedContent.trim() + "\n\n";
        }
        console.log(
          `✅ Combined ${combatMarkdownFiles.length} combat talent files`
        );
      }
    } catch {
      console.log("No combat talents directory found, skipping combat talents");
    }

    // Add noncombat talents section
    combinedContent += `## Noncombat Talents

The talents in this section are noncombat-related talents. This categorization is for the ease of finding talents, and has no other effect.

`;

    // Combine noncombat talents
    try {
      await fs.access(NONCOMBAT_TALENTS_DIR);
      const noncombatFiles = await fs.readdir(NONCOMBAT_TALENTS_DIR);
      const noncombatMarkdownFiles = noncombatFiles
        .filter((file) => file.endsWith(".md") && file !== "CLAUDE.md" && file !== ".claude-md-manager.md")
        .sort(); // Sort alphabetically for consistent ordering

      if (noncombatMarkdownFiles.length > 0) {
        for (const filename of noncombatMarkdownFiles) {
          const talentPath = path.join(NONCOMBAT_TALENTS_DIR, filename);
          const talentContent = await fs.readFile(talentPath, "utf-8");

          // Convert ## headers to ### headers for individual talents
          const adjustedContent = talentContent.replace(/^## /gm, "### ");
          combinedContent += adjustedContent.trim() + "\n\n";
        }
        console.log(
          `✅ Combined ${noncombatMarkdownFiles.length} noncombat talent files`
        );
      }
    } catch {
      console.log(
        "No noncombat talents directory found, skipping noncombat talents"
      );
    }

    combinedContent += `## Elemental Talents

The talents in this section are elemental talents. Each talent will have one or more elemental tags, indicating the element it is associated with, and the attunement(s) required to pick up the talent.

These talents also may include the tag "ongoing", indicating that the effect lasts for 1 minute. Players may choose to end the effect early as a free ability during the action phase.

`;

    // Combine spells

    try {
      await fs.access(SPELLS_DIR);
      const spellsFiles = await fs.readdir(SPELLS_DIR);
      const spellsMarkdownFiles = spellsFiles
        .filter((file) => file.endsWith(".md") && file !== "CLAUDE.md" && file !== ".claude-md-manager.md")
        .sort(); // Sort alphabetically for consistent ordering

      if (spellsMarkdownFiles.length > 0) {
        for (const filename of spellsMarkdownFiles) {
          const spellPath = path.join(SPELLS_DIR, filename);
          const spellContent = await fs.readFile(spellPath, "utf-8");

          // Convert ## headers to ### headers for individual talents
          const adjustedContent = spellContent.replace(/^## /gm, "### ");
          combinedContent += adjustedContent.trim() + "\n\n";
        }
        console.log(`✅ Combined ${spellsMarkdownFiles.length} spell files`);
      }
    } catch {
      console.log("No spells directory found, skipping spell file combination");
    }

    // Write the combined file to the source directory
    const outputPath = path.join(SOURCE_DIR, "Talents.md");
    await fs.writeFile(outputPath, combinedContent.trim());

    console.log(
      `✅ Combined talent files into Talents.md and spells into Spells.md`
    );
  } catch (error) {
    console.error("Error combining talent files:", error);
    throw error;
  }
}

/**
 * Collects markdown files from a directory (non-recursive, top-level only)
 */
async function collectTopLevelMarkdownFiles(dir: string): Promise<string[]> {
  const markdownFiles: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== "CLAUDE.md" &&
        entry.name !== ".claude-md-manager.md"
      ) {
        markdownFiles.push(entry.name);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return markdownFiles.sort();
}

/**
 * Converts a filename to a display title
 * e.g., "Zhorheim_Mountains.md" -> "Zhorheim Mountains"
 */
function filenameToTitle(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .replace(/_/g, " ");
}

/**
 * Combines markdown files from a directory into a single super-document
 */
async function combineDirectoryToSuperDocument(
  sourceDir: string,
  outputPath: string,
  documentTitle: string
): Promise<number> {
  const files = await collectTopLevelMarkdownFiles(sourceDir);

  if (files.length === 0) {
    return 0;
  }

  let combinedContent = `# ${documentTitle}\n\n`;

  for (const filename of files) {
    const filePath = path.join(sourceDir, filename);
    let fileContent = await fs.readFile(filePath, "utf-8");

    // If file already starts with a ## header, use that directly
    // Otherwise, generate a header from the filename
    const startsWithH2 = /^##\s+/.test(fileContent.trim());

    if (startsWithH2) {
      // File already has proper header structure, use as-is
      combinedContent += fileContent.trim() + "\n\n";
    } else {
      // Add header from filename
      const title = filenameToTitle(filename);
      combinedContent += `## ${title}\n\n`;
      combinedContent += fileContent.trim() + "\n\n";
    }
  }

  await fs.writeFile(outputPath, combinedContent.trim());
  return files.length;
}

/**
 * Combines all Alaria world wiki files into super-documents in all_sections_formatted/
 */
export async function combineAlariaFiles(): Promise<void> {
  console.log("Combining Alaria world wiki files...");

  const worldDir = path.join(WORLDS_SOURCE_DIR, "alaria");
  const outputDir = path.join(worldDir, "all_sections_formatted");

  try {
    await fs.access(worldDir);
  } catch {
    console.log("  Alaria world directory not found, skipping");
    return;
  }

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  for (const category of ALARIA_CATEGORIES) {
    const categoryPath = path.join(worldDir, category.sourceDir);

    // First, process any subdirectories as separate super-documents
    if (category.subdirectories) {
      for (const subdir of category.subdirectories) {
        const subdirPath = path.join(categoryPath, subdir.sourceDir);
        const subdirOutputPath = path.join(outputDir, `${subdir.outputName}.md`);
        const displayTitle = subdir.outputName.replace(/_/g, " ").replace(/&/g, "&");

        const count = await combineDirectoryToSuperDocument(
          subdirPath,
          subdirOutputPath,
          displayTitle
        );

        if (count > 0) {
          console.log(`  ✅ Combined ${count} files into ${subdir.outputName}.md`);
        }
      }
    }

    // Then combine top-level files (excluding subdirectories) into main category document
    const outputPath = path.join(outputDir, `${category.outputName}.md`);
    const displayTitle = category.outputName.replace(/_/g, " ").replace(/&/g, "&");

    const count = await combineDirectoryToSuperDocument(
      categoryPath,
      outputPath,
      displayTitle
    );

    if (count > 0) {
      console.log(`  ✅ Combined ${count} files into ${category.outputName}.md`);
    }
  }

  console.log("✅ Alaria file combination complete");
}
