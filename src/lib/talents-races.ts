import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export interface TalentData {
  id: string;
  name: string;
  category: 'combat' | 'noncombat';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RaceData {
  id: string;
  name: string;
  content: string;
  metadata?: Record<string, unknown>;
}

const TALENTS_DIR = path.join(process.cwd(), 'heart_rush', 'talents');
const RACES_DIR = path.join(process.cwd(), 'heart_rush', 'races');

async function parseMarkdownFile(filePath: string): Promise<{ content: string; metadata?: Record<string, unknown> }> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const { data, content } = matter(fileContent);
    return { content: content.trim(), metadata: Object.keys(data).length > 0 ? data : undefined };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return { content: '' };
  }
}

export async function getAllTalents(): Promise<TalentData[]> {
  const talents: TalentData[] = [];
  
  try {
    const combatDir = path.join(TALENTS_DIR, 'combat_talents');
    const noncombatDir = path.join(TALENTS_DIR, 'noncombat_talents');
    
    // Process combat talents
    const combatFiles = await fs.readdir(combatDir);
    for (const file of combatFiles) {
      if (file.endsWith('.md')) {
        const filePath = path.join(combatDir, file);
        const { content, metadata } = await parseMarkdownFile(filePath);
        const name = path.basename(file, '.md').replace(/_/g, ' ');
        talents.push({
          id: path.basename(file, '.md'),
          name,
          category: 'combat',
          content,
          metadata
        });
      }
    }
    
    // Process noncombat talents
    const noncombatFiles = await fs.readdir(noncombatDir);
    for (const file of noncombatFiles) {
      if (file.endsWith('.md')) {
        const filePath = path.join(noncombatDir, file);
        const { content, metadata } = await parseMarkdownFile(filePath);
        const name = path.basename(file, '.md').replace(/_/g, ' ');
        talents.push({
          id: path.basename(file, '.md'),
          name,
          category: 'noncombat',
          content,
          metadata
        });
      }
    }
  } catch (error) {
    console.error('Error reading talents directory:', error);
  }
  
  return talents.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllRaces(): Promise<RaceData[]> {
  const races: RaceData[] = [];
  
  try {
    const files = await fs.readdir(RACES_DIR);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(RACES_DIR, file);
        const { content, metadata } = await parseMarkdownFile(filePath);
        const name = path.basename(file, '.md').replace(/_/g, ' ');
        races.push({
          id: path.basename(file, '.md'),
          name,
          content,
          metadata
        });
      }
    }
  } catch (error) {
    console.error('Error reading races directory:', error);
  }
  
  return races.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTalentById(id: string): Promise<TalentData | null> {
  const talents = await getAllTalents();
  return talents.find(talent => talent.id === id) || null;
}

export async function getRaceById(id: string): Promise<RaceData | null> {
  const races = await getAllRaces();
  return races.find(race => race.id === id) || null;
}