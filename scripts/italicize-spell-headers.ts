#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

const SPELLS_FILE = path.join(process.cwd(), 'heart_rush/all_sections_formatted/Spells.md');

function italicizeSpellHeaders(content: string): string {
  // Pattern to match lines that contain element names and optionally "Ongoing", "Immediate", or "Instant"
  // These appear after spell names (### headers) and contain combinations like:
  // "Fire. Ongoing.", "Earth and Dark. Ongoing", "Fire and Force.", "Air. Immediate.", etc.
  // The pattern looks for lines that start with capital letters, may have "and" between elements,
  // followed by a period, and optionally followed by Ongoing/Immediate/Instant with periods and spaces
  const headerPattern = /^([A-Z][a-z]*(?:\s+and\s+[A-Z][a-z]*)*\.(?:\s+(?:Ongoing|Immediate|Instant)\.)*)\s*$/gm;
  
  return content.replace(headerPattern, (match) => {
    return `*${match.trim()}*`;
  });
}

function main() {
  try {
    console.log('Reading Spells.md...');
    const content = fs.readFileSync(SPELLS_FILE, 'utf8');
    
    console.log('Adding italics to spell subheaders...');
    const updatedContent = italicizeSpellHeaders(content);
    
    console.log('Writing updated content back to file...');
    fs.writeFileSync(SPELLS_FILE, updatedContent, 'utf8');
    
    console.log('✅ Successfully italicized spell subheaders in Spells.md');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();