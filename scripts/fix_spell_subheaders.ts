#!/usr/bin/env tsx
import fs from "fs/promises";
import path from "path";

const SPELLS_DIR = path.join("heart_rush", "talents", "spells");

async function fixSubheaderInFile(filePath: string) {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split(/\r?\n/);

  // Find the header and the italic subheader
  let headerIdx = lines.findIndex((l) => l.startsWith("### "));
  if (headerIdx === -1) return false;

  // Find the first line that is only an italic subheader (e.g. _..._)
  let italicIdx = lines.findIndex(
    (l, i) => i > headerIdx && /^_[^_]+_$/.test(l.trim())
  );
  if (italicIdx === -1) return false;

  // If the italic subheader is not immediately after the header, move it
  if (italicIdx !== headerIdx + 1) {
    const italicLine = lines[italicIdx];
    lines.splice(italicIdx, 1); // Remove from old position
    lines.splice(headerIdx + 1, 0, italicLine); // Insert after header
    await fs.writeFile(filePath, lines.join("\n"), "utf-8");
    return true;
  }
  return false;
}

async function main() {
  const files = (await fs.readdir(SPELLS_DIR)).filter((f) => f.endsWith(".md"));
  let changed = 0;
  for (const file of files) {
    const filePath = path.join(SPELLS_DIR, file);
    const fixed = await fixSubheaderInFile(filePath);
    if (fixed) {
      console.log(`Fixed: ${file}`);
      changed++;
    }
  }
  console.log(`\n✅ Fixed subheader line position in ${changed} spell files.`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
