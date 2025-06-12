const WORDS_PER_MINUTE = 200;

export function calculateReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function generateSlug(title: string, existingSlugs: Set<string>): string {
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

export function generateCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function extractCrossReferences(content: string): string[] {
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

export function extractTags(content: string, title: string): string[] {
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