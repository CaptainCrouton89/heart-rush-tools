#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

interface SectionData {
  [heading: string]: {
    content: string;
    children?: SectionData;
  };
}

function parseMarkdownToJson(content: string): SectionData {
  const lines = content.split('\n');
  const result: SectionData = {};
  const stack: Array<{ level: number; section: { content: string; children?: SectionData } }> = [];
  let currentContent: string[] = [];
  
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();
      
      // Pop stack until we find the right parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        const popped = stack.pop()!;
        popped.section.content = currentContent.join('\n').trim();
        currentContent = [];
      }
      
      // Create new section
      const section: { content: string; children?: SectionData } = { content: '' };
      
      // Find where to place this heading
      if (stack.length === 0) {
        result[heading] = section;
      } else {
        const parent = stack[stack.length - 1].section;
        if (!parent.children) {
          parent.children = {};
        }
        parent.children[heading] = section;
      }
      
      // Push current section onto stack
      stack.push({ level, section });
      currentContent = [];
    } else {
      // Add content line
      currentContent.push(line);
    }
  }
  
  // Handle remaining sections in stack
  while (stack.length > 0) {
    const popped = stack.pop()!;
    popped.section.content = currentContent.join('\n').trim();
    currentContent = [];
  }
  
  // Clean up empty children objects
  const cleanupEmpty = (obj: SectionData) => {
    for (const key in obj) {
      if (obj[key].children) {
        cleanupEmpty(obj[key].children!);
        if (Object.keys(obj[key].children!).length === 0) {
          delete obj[key].children;
        }
      }
    }
  };
  
  cleanupEmpty(result);
  return result;
}

function processFile(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = parseMarkdownToJson(content);
    
    const fileName = path.basename(filePath, '.md');
    const outputPath = path.join(process.cwd(), 'content', `${fileName}.json`);
    
    // Ensure content directory exists
    const contentDir = path.dirname(outputPath);
    if (!fs.existsSync(contentDir)) {
      fs.mkdirSync(contentDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2));
    console.log(`✓ Converted ${fileName}.md → ${fileName}.json`);
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error);
  }
}

function main(): void {
  const inputDir = path.join(process.cwd(), 'heart_rush', 'all_sections_formatted');
  
  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(inputDir)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(inputDir, file));
  
  console.log(`Processing ${files.length} markdown files...`);
  
  files.forEach(processFile);
  
  console.log('\n✓ All files processed successfully!');
}

if (require.main === module) {
  main();
}