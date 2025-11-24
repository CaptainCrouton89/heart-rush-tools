#!/usr/bin/env npx ts-node

/**
 * Transform Alaria wiki content to standardized markdown format.
 *
 * Template:
 * ## [Title from filename]
 *
 * Tags: [existing tags or default]
 *
 * [content with headers downgraded: # -> ##, ## -> ###, etc.]
 *
 * Special "overview" files (like World Timeline.md) get different treatment:
 * - They keep their structure but still start with ## Title
 * - Their internal headers are downgraded appropriately
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALARIA_ROOT = path.join(__dirname, '../world-wikis/alaria');

// Files that are major category overviews - they need ## title but keep rich structure
const OVERVIEW_FILES = new Set([
  'World Timeline.md',
  'Magic.md',
  'Planes.md',
  'Factions.md',
  'States.md',
]);

// Directories to process (skip atlas_of_alaria since it's already done)
const DIRECTORIES_TO_PROCESS = [
  'bestiary',
  'cosmology_and_religion',
  'dramatis_personae',
  'history_and_lore',
  'magic_and_knowledge',
  'nations_and_powers',
];

// Default tags by directory
const DEFAULT_TAGS: Record<string, string> = {
  'bestiary': 'creature',
  'cosmology_and_religion': 'cosmology',
  'dramatis_personae': 'npc',
  'history_and_lore': 'history',
  'magic_and_knowledge': 'magic',
  'nations_and_powers': 'faction',
};

interface TransformResult {
  file: string;
  changed: boolean;
  hadH1: boolean;
  hadNoTags: boolean;
  hadNoHeader: boolean;
}

function getTitleFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '');
}

function extractTags(content: string): { tags: string | null; contentWithoutTags: string } {
  const lines = content.split('\n');

  // Look for Tags: line at the start (possibly after a header)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line.startsWith('Tags:')) {
      const tags = line.substring(5).trim();
      const contentWithoutTags = [
        ...lines.slice(0, i),
        ...lines.slice(i + 1)
      ].join('\n').trim();
      return { tags, contentWithoutTags };
    }
  }

  return { tags: null, contentWithoutTags: content };
}

function downgradeHeaders(content: string, hasH1: boolean): string {
  const lines = content.split('\n');
  // If content had H1 headers, we need to downgrade by 2 levels (# -> ###)
  // because we're adding ## Title at the top
  // If content only had H2+, we downgrade by 1 level (## -> ###)
  const downgradeAmount = hasH1 ? 2 : 1;

  return lines.map(line => {
    // Match header lines
    const headerMatch = line.match(/^(#{1,5})\s+(.+)$/);
    if (headerMatch) {
      const hashes = headerMatch[1];
      const text = headerMatch[2];
      // Add appropriate # to downgrade
      // Cap at 6 hashes
      const newHashes = '#'.repeat(Math.min(hashes.length + downgradeAmount, 6));
      return `${newHashes} ${text}`;
    }
    return line;
  }).join('\n');
}

function hasH1Header(content: string): boolean {
  return content.split('\n').some(line => /^#\s+[^#]/.test(line));
}

function startsWithHeader(content: string): boolean {
  const firstNonEmptyLine = content.split('\n').find(l => l.trim().length > 0);
  return firstNonEmptyLine ? /^#{1,6}\s+/.test(firstNonEmptyLine) : false;
}

function transformFile(filePath: string, directory: string): TransformResult {
  const filename = path.basename(filePath);
  const title = getTitleFromFilename(filename);
  const originalContent = fs.readFileSync(filePath, 'utf-8');

  const result: TransformResult = {
    file: filePath,
    changed: false,
    hadH1: hasH1Header(originalContent),
    hadNoTags: false,
    hadNoHeader: false,
  };

  // Extract existing tags
  let { tags, contentWithoutTags } = extractTags(originalContent);

  // Check if we need to add default tags
  if (!tags) {
    const defaultTag = DEFAULT_TAGS[directory];
    if (!defaultTag) {
      throw new Error(`No default tag defined for directory: ${directory}`);
    }
    tags = defaultTag;
    result.hadNoTags = true;
  }

  // Remove any existing title header that matches the filename
  // (to avoid duplication like "## Dragons" when file is Dragons.md)
  let cleanedContent = contentWithoutTags;
  const titleHeaderRegex = new RegExp(`^#{1,6}\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im');
  cleanedContent = cleanedContent.replace(titleHeaderRegex, '').trim();

  // Check if the content already starts with ## Title (already transformed)
  const alreadyTransformed = cleanedContent.startsWith(`## ${title}`);

  if (alreadyTransformed) {
    // File is already in the right format, skip
    return result;
  }

  // Check if content has headers that need downgrading
  result.hadNoHeader = !startsWithHeader(cleanedContent);

  // Downgrade all headers (# -> ###, ## -> ###, etc.)
  // Pass whether original content had H1 to determine downgrade amount
  const downgradedContent = downgradeHeaders(cleanedContent, result.hadH1);

  // Build the new content
  const newContent = `## ${title}

Tags: ${tags}

${downgradedContent.trim()}
`;

  // Only write if content actually changed
  if (newContent.trim() !== originalContent.trim()) {
    fs.writeFileSync(filePath, newContent);
    result.changed = true;
  }

  return result;
}

function processDirectory(dirName: string): TransformResult[] {
  const dirPath = path.join(ALARIA_ROOT, dirName);
  const results: TransformResult[] = [];

  if (!fs.existsSync(dirPath)) {
    console.log(`Directory not found: ${dirPath}`);
    return results;
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const result = transformFile(filePath, dirName);
    results.push(result);
  }

  return results;
}

function main() {
  console.log('Transforming Alaria wiki content...\n');

  const allResults: TransformResult[] = [];

  for (const dir of DIRECTORIES_TO_PROCESS) {
    console.log(`Processing ${dir}...`);
    const results = processDirectory(dir);
    allResults.push(...results);

    const changed = results.filter(r => r.changed).length;
    const withH1 = results.filter(r => r.hadH1).length;
    const noTags = results.filter(r => r.hadNoTags).length;

    console.log(`  ${results.length} files, ${changed} changed, ${withH1} had H1 headers, ${noTags} missing tags\n`);
  }

  // Summary
  const totalChanged = allResults.filter(r => r.changed).length;
  const totalH1 = allResults.filter(r => r.hadH1).length;
  const totalNoTags = allResults.filter(r => r.hadNoTags).length;

  console.log('=== Summary ===');
  console.log(`Total files processed: ${allResults.length}`);
  console.log(`Files changed: ${totalChanged}`);
  console.log(`Files that had H1 headers (downgraded): ${totalH1}`);
  console.log(`Files missing tags (defaults added): ${totalNoTags}`);

  // List files with H1 headers that were downgraded
  if (totalH1 > 0) {
    console.log('\nFiles with H1 headers that were downgraded:');
    allResults.filter(r => r.hadH1).forEach(r => {
      console.log(`  - ${path.relative(ALARIA_ROOT, r.file)}`);
    });
  }
}

main();
