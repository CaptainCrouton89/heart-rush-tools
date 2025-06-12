#!/usr/bin/env tsx
import fs from "fs/promises";
import path from "path";

const SPELLS_MD = path.join(
  "heart_rush",
  "all_sections_formatted",
  "Spells.md"
);
const OUTPUT_DIR = path.join("heart_rush", "talents", "spells");

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

async function main() {
  console.log(`Reading spells from: ${SPELLS_MD}`);
  const content = await fs.readFile(SPELLS_MD, "utf-8");

  // Split on level 3 headers (### Spell Name)
  const spellSections = content.split(/(^### .+$)/m).filter(Boolean);

  // spellSections alternates: [prelude?, header, body, header, body, ...]
  let spells: { name: string; body: string }[] = [];
  for (let i = 0; i < spellSections.length; i++) {
    const section = spellSections[i];
    if (section.startsWith("### ")) {
      const name = section.replace(/^### /, "").trim();
      const body = (spellSections[i + 1] || "").trim();
      spells.push({ name, body });
      i++; // skip body
    }
  }

  // Prepare output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Write each spell to its own file
  for (const spell of spells) {
    const filename = sanitizeFilename(spell.name) + ".md";
    const filePath = path.join(OUTPUT_DIR, filename);
    const fileContent = `### ${spell.name}\n\n${spell.body}\n`;
    await fs.writeFile(filePath, fileContent, "utf-8");
    console.log(`Wrote: ${filePath}`);
  }

  console.log(`\n✅ Split ${spells.length} spells into ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
