# Content Combination Patterns - Reference Guide

This document summarizes the file combination patterns used in Heart Rush content compilation. Use this as a quick reference for understanding how the system works and how to apply it to new content areas.

**Investigation documents available in:** `/docs/investigations/`
- `SUMMARY.md` - Quick overview
- `content-combination-pattern.md` - Comprehensive investigation
- `file-combination-code-patterns.md` - Code reference with snippets
- `alaria-daemon-implementation-guide.md` - Step-by-step implementation

---

## The Pattern in Plain English

The system keeps files organized individually while creating super-documents for processing.

```
Step 1: Individual Files
  heart_rush/races/Alekroin.md
  heart_rush/races/Ayblek.md
  heart_rush/races/Blaize.md
  ... 57 more race files

Step 2: Combination Function
  combineRaceFiles() runs before compilation
  Reads all .md files from races/
  Creates single Kin_&_Culture.md

Step 3: Processing
  Main compiler reads Kin_&_Culture.md
  Splits into sections by headers
  Generates JSON output
  Creates navigation hierarchy

Step 4: Result
  Individual race files unchanged
  JSON files generated for each race
  Navigation tree built
  Search index created
```

---

## Pattern 1: Simple Combination (Races)

**When to use:** Individual files that should be sections in a super-document

**Example:** `combineRaceFiles()` in `file-combiners.ts:20-67`

```typescript
// 1. Create main header
let combined = "# Kin & Culture\n\n";

// 2. Read all files (sorted)
const files = await fs.readdir(RACES_DIR);
const sorted = files.filter(f => f.endsWith(".md")).sort();

// 3. Combine each file
for (const file of sorted) {
  const content = await fs.readFile(file, "utf-8");
  combined += content.trim() + "\n\n";
}

// 4. Write output
await fs.writeFile("heart_rush/all_sections_formatted/Kin_&_Culture.md", combined);
```

**Result Structure:**
```
# Kin & Culture
## Alekroin
  ### Vitals
  ### Aspects
  ### Abilities
## Ayblek
  ### Vitals
  ### Aspects
## Blaize
  ...
```

**Characteristics:**
- ✓ Simple linear combination
- ✓ Individual files are sections (## headers)
- ✓ No header adjustment needed
- ✓ Output has clear hierarchy

---

## Pattern 2: Multi-Section Combination (Talents)

**When to use:** Multiple directories that should be sections in one super-document

**Example:** `combineTalentFiles()` in `file-combiners.ts:69-227`

```typescript
// 1. Create main header + intro
let combined = "# Talents\n\n[introduction text...]\n\n";

// 2. Add first section header
combined += "## Combat Talents\n\n";

// 3. Combine combat talent files
const combatFiles = await fs.readdir(COMBAT_TALENTS_DIR);
for (const file of combatFiles.filter(f => f.endsWith(".md")).sort()) {
  const content = await fs.readFile(file, "utf-8");
  // Heading levels are normalized automatically during combination
  combined += content.trim() + "\n\n";
}

// 4. Repeat for other sections
combined += "## Noncombat Talents\n\n";
for (const file of noncombatFiles) {
  const content = await fs.readFile(file, "utf-8");
  combined += content.trim() + "\n\n";
}

// 5. Repeat for spells section (no manual heading tweaks required)

// 6. Write output
await fs.writeFile("heart_rush/all_sections_formatted/Talents.md", combined);
```

**Result Structure:**
```
# Talents
[introduction]

## Combat Talents
[description]
### Combat Talent 1
### Combat Talent 2
...

## Noncombat Talents
[description]
### Noncombat Talent 1
...

## Elemental Talents
[description]
### Spell 1
...
```

**Characteristics:**
- ✓ Multiple subsections with headers
- ✓ Section introductions/descriptions
- ✓ Header level adjustment (## → ###)
- ✓ Complex hierarchy
- ✓ Files from multiple directories

---

## Pattern 3: Recursive World Wiki Combination

**When to use:** World wiki categories with files in subdirectories

**Example:** `combineWorldWikiCategory()` in `file-combiners.ts:256-309`

```typescript
export async function combineWorldWikiCategory(
  worldName: string,
  categoryDir: string
): Promise<string> {
  // 1. Recursively find all markdown files
  const files = await recursivelyCollectMarkdownFiles(categoryPath);

  // 2. Create category header
  const displayName = categoryDir.replace(/_/g, " ").toTitleCase();
  let combined = `# ${displayName}\n\n`;

  // 3. For each file, create ## header from filename
  for (const file of files.sort()) {
    const content = await fs.readFile(file, "utf-8");
    const name = path.basename(file, ".md").replace(/_/g, " ");
    combined += `## ${name}\n\n`;
    combined += content.trim() + "\n\n";
  }

  // 4. Write to world root (not subdirectory)
  const outputPath = path.join(worldSourceDir, `${displayName}.md`);
  await fs.writeFile(outputPath, combined);

  return outputPath; // Return for cleanup
}
```

**Result Structure:**
```
# Bestiary
## Dragon
[content from dragon.md]
## Goblin
[content from goblin.md]
## Orc
[content from orc.md]
...
```

**Characteristics:**
- ✓ Handles nested subdirectories recursively
- ✓ Creates headers from filenames
- ✓ Output written to world root
- ✓ Returns path for cleanup
- ✓ Temporary files deleted after use

---

## Integration with Main Compilation

### For Heart Rush Content

**File:** `scripts/compile-content.ts:42-50`

```typescript
async function compilePlayerContent() {
  // FIRST: Combine files into super-documents
  await combineRaceFiles();      // Creates Kin_&_Culture.md
  await combineTalentFiles();    // Creates Talents.md

  // THEN: Process all files normally
  const files = await fs.readdir(SOURCE_DIR);
  for (const file of files) {
    const content = await fs.readFile(file, "utf-8");
    const sections = splitContent(content, file); // Splits by headers
    // ... process each section into JSON ...
  }
}
```

### For World Wiki Content

**File:** `scripts/compile-content.ts:333-531`

```typescript
async function compileWorldWiki(worldName) {
  // FIRST: Combine category directories
  const combinedFiles = await combineWorldWikiFiles(worldName);

  // THEN: Skip combined directories, process files normally
  async function findMarkdownFiles(dir) {
    if (combinableDirectories.has(dir.name)) {
      continue; // Skip - we're reading the combined file instead
    }
    // ... find other markdown files ...
  }

  // FINALLY: Cleanup combined files
  await cleanupCombinedWorldFiles(combinedFiles);
}
```

---

## Applying to Alaria Daemons

The system already supports this pattern for Alaria. To add daemons:

### Current Setup
```
world-wikis/alaria/bestiary/    (157 creature files)
  Combined into: Bestiary.md
```

### Recommended Setup
```
world-wikis/alaria/bestiary/daemons/    (157 daemon files)
  Combined into: Daemons.md
```

### Implementation (1 line change)

**File:** `scripts/lib/file-combiners.ts:13-18`

```typescript
const WORLD_WIKI_COMBINABLE_DIRS = [
  "nations_and_powers",
  "atlas_of_alaria",
  "dramatis_personae",
  "bestiary",
  "daemons"  // ADD THIS LINE
];
```

That's it. The existing `combineWorldWikiCategory()` function handles everything else.

---

## Key Code Locations

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `combineRaceFiles()` | `file-combiners.ts` | 20-67 | Combines races into single file |
| `combineTalentFiles()` | `file-combiners.ts` | 69-227 | Combines talents, noncombat, spells |
| `combineWorldWikiCategory()` | `file-combiners.ts` | 256-309 | Recursively combines world wiki categories |
| `combineWorldWikiFiles()` | `file-combiners.ts` | 311-339 | Orchestrates category combinations |
| `compilePlayerContent()` | `compile-content.ts` | 42-199 | Main player content pipeline |
| `compileWorldWiki()` | `compile-content.ts` | 333-531 | Main world wiki pipeline |
| `splitContent()` | `content-processors.ts` | (imported) | Splits combined documents by headers |

---

## Design Principles

### 1. Separation of Organization and Processing

**Source:** Individual files organized by file system
**Processing:** Super-documents for compilation pipeline
**Output:** JSON files for app consumption

### 2. Header Hierarchy = Section Hierarchy

```
# Title                           ← Category
## Subsection                     ← Top-level section
  ### Sub-subsection             ← Nested section
    #### Detail                  ← Further nesting
```

Becomes JSON hierarchy:
```
{
  slug: "title",
  parent: null,
  children: ["subsection"]
}
{
  slug: "subsection",
  parent: "title",
  children: ["sub-subsection"]
}
```

### 3. Alphabetical Sorting is Important

All file combinations sort alphabetically:
- Ensures consistent ordering across builds
- Makes results reproducible
- Important for testing and diffs

### 4. Temporary Files are Cleaned Up

World wiki combined files are deleted after processing:
- Keeps source directory clean
- Prevents merge conflicts
- Files are recreated on each build

Heart Rush combined files stay:
- Intentionally checked into git
- Allows tracking changes to super-documents
- Makes review easier (see merged result)

---

## Common Implementation Checklist

When adding a new combined category:

- [ ] Create source directory structure
  ```
  world-wikis/[world]/[category]/
  └── [subcategories and files]/
  ```

- [ ] Add category to combinable list
  ```typescript
  const WORLD_WIKI_COMBINABLE_DIRS = [
    ...,
    "[new-category]"
  ];
  ```

- [ ] Ensure files follow naming convention
  - Filenames become section headers
  - Use underscores for spaces
  - Avoid special characters
  - Sort alphabetically

- [ ] Test compilation
  ```bash
  pnpm run compile-content
  ```

- [ ] Verify output
  - Combined file created
  - Sections generated correctly
  - Navigation hierarchy appears
  - Search index includes new content

- [ ] Test in app
  ```bash
  pnpm run dev
  # Check new category appears
  # Verify individual items accessible
  # Test search functionality
  ```

---

## Troubleshooting

### Combined file not created
- Check source directory exists and contains `.md` files
- Verify directory path in combinable list matches actual path
- Ensure markdown files end with `.md`

### Sections missing parent relationships
- Verify header hierarchy in source files
- Check headers follow proper level progression (# → ## → ###)
- Ensure no header level jumps (### without ## parent)

### Navigation not showing new category
- Verify combined file was created
- Check main compilation didn't skip the directory
- Review navigation.json generation logic

### Cross-references broken
- Verify slug format in links matches generated JSON filenames
- Check file paths in markdown links point to correct locations
- Review cross-reference extraction in content-processors.ts

---

## Further Reading

**Comprehensive investigations available in:** `/docs/investigations/`

1. **SUMMARY.md** (6 KB)
   - Quick overview of the pattern
   - Key examples
   - Implementation steps

2. **content-combination-pattern.md** (12 KB)
   - Detailed explanation of each pattern
   - How processing pipeline handles combined files
   - Design decisions and rationale

3. **file-combination-code-patterns.md** (16 KB)
   - Complete code snippets for each pattern
   - Line-by-line explanation
   - Integration with compilation
   - Template for new patterns

4. **alaria-daemon-implementation-guide.md** (11 KB)
   - Step-by-step implementation for daemon files
   - File organization recommendations
   - Testing and verification procedures
   - Troubleshooting guide

---

## Questions?

Refer to the investigation documents for detailed explanations of:
- How header levels affect section hierarchy
- Why temporary files are cleaned up
- How cross-references are resolved
- Performance implications at scale
- Edge cases and error handling
- Integration with search indexing
