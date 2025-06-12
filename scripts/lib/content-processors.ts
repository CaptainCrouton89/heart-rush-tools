import { SectionData } from "./types.js";

export function splitContent(
  content: string,
  filename: string
): SectionData[] {
  const sections: SectionData[] = [];

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
    const headerEnd = content.indexOf("\n", currentMatch.index);
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
        const contentBeforeChildren = content
          .slice(startPos, matches[i + 1].index)
          .trim();
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
      console.warn(
        `⚠️  Section excluded from navigation (no content): "${currentMatch.title}" (H${currentMatch.level})`
      );
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