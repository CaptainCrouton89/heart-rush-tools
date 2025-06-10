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
  image?: string;
}

interface NavigationItem {
  slug: string;
  title: string;
  level: number;
  parent?: string;
  order: number;
  children?: NavigationItem[];
}

interface NavigationCategory {
  name: string;
  sections: string[];
}

interface CategorizedNavigationItem {
  type: 'category' | 'section';
  name?: string; // For category headers
  slug?: string; // For sections
  title?: string; // For sections
  level?: number; // For sections
  parent?: string; // For sections
  order: number;
  children?: CategorizedNavigationItem[];
}

const WORDS_PER_MINUTE = 200;
const SOURCE_DIR = "heart_rush/all_sections_formatted";
const GM_SOURCE_DIR = "heart_rush/gm_guide";
const RACES_DIR = "heart_rush/races";
const RACES_IMAGES_DIR = "heart_rush/races/images";
const PUBLIC_IMAGES_DIR = "public/heart_rush/races/images";
const TALENTS_DIR = "heart_rush/talents";
const COMBAT_TALENTS_DIR = "heart_rush/talents/combat_talents";
const NONCOMBAT_TALENTS_DIR = "heart_rush/talents/noncombat_talents";
const OUTPUT_DIR = "content";
const GM_OUTPUT_DIR = "content/gm";
const CATEGORIES_CONFIG_PATH = "navigation-categories.json";
const GM_CATEGORIES_CONFIG_PATH = "gm-navigation-categories.json";

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

async function loadNavigationCategories(configPath: string = CATEGORIES_CONFIG_PATH): Promise<NavigationCategory[]> {
  try {
    const categoriesContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(categoriesContent);
    return config.categories || [];
  } catch (error) {
    console.warn(`No navigation categories configuration found at ${configPath}, using default alphabetical ordering`);
    return [];
  }
}

function createCategorizedNavigation(
  sections: ContentSection[], 
  categories: NavigationCategory[]
): CategorizedNavigationItem[] {
  if (categories.length === 0) {
    // Fallback to original navigation structure
    const navigation: NavigationItem[] = [];
    const navigationMap = new Map<string, NavigationItem>();

    for (const section of sections) {
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

    return navigation.map(item => ({
      type: 'section' as const,
      slug: item.slug,
      title: item.title,
      level: item.level,
      parent: item.parent,
      order: item.order,
      children: item.children?.map(child => ({
        type: 'section' as const,
        slug: child.slug,
        title: child.title,
        level: child.level,
        parent: child.parent,
        order: child.order,
        children: child.children?.map(grandchild => ({
          type: 'section' as const,
          slug: grandchild.slug,
          title: grandchild.title,
          level: grandchild.level,
          parent: grandchild.parent,
          order: grandchild.order,
          children: []
        }))
      }))
    }));
  }

  // Create categorized navigation
  const categorizedNav: CategorizedNavigationItem[] = [];
  const sectionMap = new Map<string, ContentSection[]>();
  
  // Group sections by their base filename (category)
  for (const section of sections) {
    const key = section.category;
    if (!sectionMap.has(key)) {
      sectionMap.set(key, []);
    }
    sectionMap.get(key)!.push(section);
  }

  // Categories are already in the correct order from the array
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const categoryItem: CategorizedNavigationItem = {
      type: 'category',
      name: category.name,
      order: i,
      children: []
    };

    // Add sections for this category in the specified order
    for (const sectionKey of category.sections) {
      const sectionsForKey = sectionMap.get(sectionKey.replace(/_/g, ' ').replace(/,/g, ' &'));
      if (sectionsForKey) {
        // Create navigation tree for this section group
        const navigationMap = new Map<string, CategorizedNavigationItem>();
        
        for (const section of sectionsForKey) {
          const navItem: CategorizedNavigationItem = {
            type: 'section',
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
            categoryItem.children!.push(navItem);
          }
        }
      }
    }

    if (categoryItem.children!.length > 0) {
      categorizedNav.push(categoryItem);
    }
  }

  // Add any uncategorized sections
  const categorizedSectionKeys = new Set(
    categories.flatMap(cat => cat.sections.map(s => s.replace(/_/g, ' ').replace(/,/g, ' &')))
  );
  
  const uncategorizedSections = sections.filter(
    section => !categorizedSectionKeys.has(section.category)
  );

  if (uncategorizedSections.length > 0) {
    const uncategorizedItem: CategorizedNavigationItem = {
      type: 'category',
      name: 'Other',
      order: 999,
      children: []
    };

    const navigationMap = new Map<string, CategorizedNavigationItem>();
    
    for (const section of uncategorizedSections) {
      const navItem: CategorizedNavigationItem = {
        type: 'section',
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
        uncategorizedItem.children!.push(navItem);
      }
    }

    categorizedNav.push(uncategorizedItem);
  }

  return categorizedNav;
}

async function copyRaceImages(): Promise<void> {
  try {
    // Check if source images directory exists
    await fs.access(RACES_IMAGES_DIR);
    
    // Ensure public images directory exists
    await fs.mkdir(PUBLIC_IMAGES_DIR, { recursive: true });
    
    // Read all files in the source images directory
    const imageFiles = await fs.readdir(RACES_IMAGES_DIR);
    
    // Common image extensions
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    
    // Copy each valid image file
    let copiedCount = 0;
    for (const imageFile of imageFiles) {
      const ext = path.extname(imageFile).toLowerCase();
      if (imageExtensions.includes(ext)) {
        const sourcePath = path.join(RACES_IMAGES_DIR, imageFile);
        const destPath = path.join(PUBLIC_IMAGES_DIR, imageFile);
        
        try {
          await fs.copyFile(sourcePath, destPath);
          copiedCount++;
        } catch (error) {
          console.warn(`Failed to copy ${imageFile}:`, error);
        }
      }
    }
    
    if (copiedCount > 0) {
      console.log(`✅ Copied ${copiedCount} race images to public directory`);
    }
  } catch (error) {
    // Directory doesn't exist - not a problem
    console.log("No race images directory found, skipping image copying");
  }
}

async function findRaceImage(title: string): Promise<string | undefined> {
  try {
    // Check if images directory exists
    await fs.access(RACES_IMAGES_DIR);
    
    // Read all files in the images directory
    const imageFiles = await fs.readdir(RACES_IMAGES_DIR);
    
    // Common image extensions
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    
    // Look for image file with matching name (case insensitive)
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    for (const imageFile of imageFiles) {
      const baseName = path.basename(imageFile, path.extname(imageFile));
      const normalizedBaseName = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (normalizedBaseName === normalizedTitle && 
          imageExtensions.includes(path.extname(imageFile).toLowerCase())) {
        return `/heart_rush/races/images/${imageFile}`;
      }
    }
  } catch (error) {
    // Directory doesn't exist or other error - not a problem
  }
  
  return undefined;
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
    
    // Check if this section has children (subsections)
    let hasChildren = false;
    if (i + 1 < matches.length) {
      const nextLevel = matches[i + 1].level;
      if (nextLevel > currentMatch.level) {
        hasChildren = true;
        // This section has children - include all content up to the first child
        const contentBeforeChildren = content.slice(startPos, matches[i + 1].index).trim();
        sectionContent = contentBeforeChildren;
      }
    }
    
    // For level 1 headers (main sections), always create the section even if no immediate content
    // This ensures main category sections exist even when they only contain subsections
    if (currentMatch.level === 1) {
      // If no content, create a minimal section with the filename-based description
      if (sectionContent.length === 0) {
        const categoryName = filename
          .replace(/\.md$/, "")
          .replace(/_/g, " ")
          .replace(/,/g, " &");
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
      console.warn(`⚠️  Section excluded from navigation (no content): "${currentMatch.title}" (H${currentMatch.level})`);
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

async function combineRaceFiles(): Promise<void> {
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
      .filter((file) => file.endsWith(".md"))
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
    
    console.log(`✅ Combined ${raceMarkdownFiles.length} race files into Kin_&_Culture.md`);
  } catch (error) {
    console.error("Error combining race files:", error);
    throw error;
  }
}

async function combineTalentFiles(): Promise<void> {
  console.log("Combining talent files into Talents.md...");
  
  try {
    // Check if talents directory exists
    const talentsPath = TALENTS_DIR;
    try {
      await fs.access(talentsPath);
    } catch {
      console.log("No talents directory found, skipping talent file combination");
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

## Combat Talents

The talents in this section are combat-related talents. This categorization is for the ease of finding talents, and has no other effect.

`;

    // Combine combat talents
    try {
      await fs.access(COMBAT_TALENTS_DIR);
      const combatFiles = await fs.readdir(COMBAT_TALENTS_DIR);
      const combatMarkdownFiles = combatFiles
        .filter((file) => file.endsWith(".md"))
        .sort(); // Sort alphabetically for consistent ordering

      if (combatMarkdownFiles.length > 0) {
        for (const filename of combatMarkdownFiles) {
          const talentPath = path.join(COMBAT_TALENTS_DIR, filename);
          const talentContent = await fs.readFile(talentPath, "utf-8");
          
          // Convert ## headers to ### headers for individual talents
          const adjustedContent = talentContent.replace(/^## /gm, "### ");
          combinedContent += adjustedContent.trim() + "\n\n";
        }
        console.log(`✅ Combined ${combatMarkdownFiles.length} combat talent files`);
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
        .filter((file) => file.endsWith(".md"))
        .sort(); // Sort alphabetically for consistent ordering

      if (noncombatMarkdownFiles.length > 0) {
        for (const filename of noncombatMarkdownFiles) {
          const talentPath = path.join(NONCOMBAT_TALENTS_DIR, filename);
          const talentContent = await fs.readFile(talentPath, "utf-8");
          
          // Convert ## headers to ### headers for individual talents
          const adjustedContent = talentContent.replace(/^## /gm, "### ");
          combinedContent += adjustedContent.trim() + "\n\n";
        }
        console.log(`✅ Combined ${noncombatMarkdownFiles.length} noncombat talent files`);
      }
    } catch {
      console.log("No noncombat talents directory found, skipping noncombat talents");
    }

    // Write the combined file to the source directory
    const outputPath = path.join(SOURCE_DIR, "Talents.md");
    await fs.writeFile(outputPath, combinedContent.trim());
    
    console.log(`✅ Combined talent files into Talents.md`);
  } catch (error) {
    console.error("Error combining talent files:", error);
    throw error;
  }
}

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
    const categorizedNavigation = createCategorizedNavigation(allSections, categories);

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
    const markdownFiles = files.filter((file) => file.endsWith(".md"));

    const allSections: ContentSection[] = [];
    const existingSlugs = new Set<string>();
    let globalOrder = 1;

    for (const filename of markdownFiles) {
      const filePath = path.join(GM_SOURCE_DIR, filename);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const { data: frontMatter, content } = matter(fileContent);

      // Extract category from frontmatter or derive from filename
      const category = frontMatter.category || filename
        .replace(/\.md$/, "")
        .replace(/_/g, " ");

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
    const gmCategories = await loadNavigationCategories(GM_CATEGORIES_CONFIG_PATH);
    const categorizedNavigation = createCategorizedNavigation(allSections, gmCategories);

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
      console.log("No GM guide directory found, skipping GM content compilation");
    }
    
    console.log("\n🎉 All content compilation completed successfully!");
  } catch (error) {
    console.error("Error during content compilation:", error);
    process.exit(1);
  }
}

// Run the compilation
compileContent().catch(console.error);
