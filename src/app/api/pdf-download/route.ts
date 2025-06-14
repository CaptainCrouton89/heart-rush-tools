import fsSync from "fs";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import nodePandoc from "node-pandoc";
import os from "os";
import path from "path";
import puppeteer from "puppeteer";
import { getAllContent, getAllContentMetadata } from "../../../lib/content";
import { ContentSection } from "../../../types/content";

export async function GET(): Promise<NextResponse> {
  try {
    // Read navigation categories to determine order

    const categoriesPath = path.join(
      process.cwd(),
      "navigation-categories.json"
    );
    const categoriesData = JSON.parse(
      fsSync.readFileSync(categoriesPath, "utf8")
    );

    // Get ALL content sections and metadata
    const allContent = await getAllContent();
    const allMetadata = await getAllContentMetadata();

    // Create maps for easy lookup
    const contentMap = new Map(allContent.map((c) => [c.slug, c]));

    // Helper function to find content by section name from navigation-categories.json
    const findContentByName = (sectionName: string): ContentSection[] => {
      const results: ContentSection[] = [];

      // Try different matching strategies
      const normalizedName = sectionName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      const possibleSlugs = [
        normalizedName,
        sectionName.toLowerCase().replace(/[^a-z0-9]+/g, ""),
        sectionName.toLowerCase().replace(/\s+/g, "-"),
      ];

      // First, try exact matches
      for (const slug of possibleSlugs) {
        const content = contentMap.get(slug);
        if (content) {
          results.push(content);
          break;
        }
      }

      // If no exact match, try partial matches
      if (results.length === 0) {
        for (const [slug, content] of contentMap) {
          if (
            slug.includes(normalizedName) ||
            content.title.toLowerCase().includes(sectionName.toLowerCase())
          ) {
            results.push(content);
            break;
          }
        }
      }

      return results;
    };

    // Helper function to recursively get all children of a section
    const getAllChildren = (parentSlug: string): ContentSection[] => {
      const children: ContentSection[] = [];
      const childMetadata = allMetadata
        .filter((m) => m.parent === parentSlug)
        .sort((a, b) => a.order - b.order);

      for (const child of childMetadata) {
        const childContent = contentMap.get(child.slug);
        if (childContent) {
          children.push(childContent);
          // Recursively get grandchildren
          const grandchildren = getAllChildren(child.slug);
          children.push(...grandchildren);
        }
      }

      return children;
    };

    // Build organized content structure
    const sectionsWithContent = [];

    for (const category of categoriesData.categories) {
      const categoryData = {
        type: "category",
        name: category.name,
        sections: [] as ContentSection[],
      };

      for (const sectionName of category.sections) {
        // Find the main section(s)
        const mainSections = findContentByName(sectionName);

        for (const section of mainSections) {
          // Add the main section
          categoryData.sections.push(section);

          // Add all its children recursively
          const children = getAllChildren(section.slug);
          categoryData.sections.push(...children);
        }
      }

      sectionsWithContent.push(categoryData);
    }

    // Generate markdown content
    let markdownContent = `% Heart Rush Digital Rulebook
% Heart Rush Team
% ${new Date().toLocaleDateString()}

\newpage

# Table of Contents

`;

    // Generate simple TOC
    for (const category of sectionsWithContent) {
      markdownContent += `\n## ${category.name}\n\n`;
      for (const section of category.sections.filter(
        (s) => (s.level || 1) === 1
      )) {
        markdownContent += `- ${section.title}\n`;
      }
    }

    markdownContent += "\n\n\\newpage\n\n";

    // Process each category
    for (const category of sectionsWithContent) {
      markdownContent += `\n\n# ${category.name}\n\n`;

      // Process sections within category
      for (const section of category.sections) {
        const level = section.level || 1;
        const headerPrefix = "#".repeat(Math.min(level + 1, 6));

        markdownContent += `\n${headerPrefix} ${section.title}\n\n`;

        // Process content - ensure proper table formatting
        let processedContent = section.content;

        // Fix table formatting for pandoc
        processedContent = processedContent.replace(/\|\s*$/gm, "|");
        processedContent = processedContent.replace(/^\s*\|/gm, "|");

        // Ensure spacing around tables
        processedContent = processedContent.replace(
          /(\n\|[^\n]+\|\n\|[-:| ]+\|(?:\n\|[^\n]+\|)*)/g,
          "\n\n$1\n\n"
        );

        markdownContent += processedContent + "\n";
      }
    }

    // Create temp files
    const tempDirPrefix = path.join(os.tmpdir(), "heart-rush-pdf-");
    const tempDir = await fs.mkdtemp(tempDirPrefix);
    const mdPath = path.join(tempDir, "content.md");

    await fs.writeFile(mdPath, markdownContent, "utf8");

    // First try to convert to HTML without external CSS (we'll embed it)
    const htmlPath = path.join(tempDir, "content.html");
    const htmlArgs = [
      "-f",
      "markdown+pipe_tables",
      "-t",
      "html5",
      "--standalone",
      "--toc",
      "--toc-depth=2",
      "-o",
      htmlPath,
    ];

    // First convert to HTML
    try {
      await new Promise<void>((resolve, reject) => {
        nodePandoc(mdPath, htmlArgs, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (err) {
      console.error("Pandoc HTML conversion error:", err);
      await fs.rm(tempDir, { recursive: true, force: true });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to convert to HTML: " + (err as Error).message,
        },
        { status: 500 }
      );
    }

    try {
      // Read the generated HTML and our custom CSS
      const htmlContent = await fs.readFile(htmlPath, "utf8");
      const cssPath = path.join(process.cwd(), "scripts", "pdf-styles.css");
      const cssContent = await fs.readFile(cssPath, "utf8");

      // Embed CSS directly into HTML by adding it in the head section
      const htmlWithEmbeddedCSS = htmlContent.replace(
        "</head>",
        `  <style>\n    ${cssContent}\n  </style>\n</head>`
      );

      try {
        // Add print instructions overlay to HTML before PDF conversion
        const htmlWithInstructions = htmlWithEmbeddedCSS.replace(
          "<body>",
          `<body>
            <div class="print-instructions no-print">
              <strong>Print Instructions:</strong><br>
              • Use "Save as PDF" in print dialog<br>
              • Select "More settings" → "Print backgrounds"<br>
              • This message won't appear in the PDF
            </div>`
        );

        // Launch puppeteer and convert HTML to PDF
        const browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.setContent(htmlWithInstructions, {
          waitUntil: "networkidle0",
        });

        const pdfBuffer = await page.pdf({
          format: "A4",
          margin: {
            top: "25mm",
            right: "25mm",
            bottom: "25mm",
            left: "25mm",
          },
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate:
            '<div style="font-size: 10px; margin: 0 auto;">Heart Rush Digital Rulebook</div>',
          footerTemplate:
            '<div style="font-size: 10px; margin: 0 auto;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        });

        await browser.close();

        // Clean up temp files
        await fs.rm(tempDir, { recursive: true, force: true });

        // Return PDF as response
        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition":
              'attachment; filename="heart-rush-rulebook.pdf"',
            "Content-Length": pdfBuffer.length.toString(),
          },
        });
      } catch (puppeteerError) {
        console.warn(
          "Puppeteer failed, falling back to HTML:",
          puppeteerError
        );

        // Add print instructions to HTML for fallback
        const htmlWithInstructions = htmlWithEmbeddedCSS.replace(
          "<body>",
          `<body>
            <div class="print-instructions no-print">
              <strong>Print to PDF Instructions:</strong><br>
              • Press Ctrl+P (or Cmd+P on Mac) to print<br>
              • Select "Save as PDF" as destination<br>
              • Enable "Print backgrounds" in More settings<br>
              • This red box won't appear in the PDF
            </div>`
        );

        // Fallback to HTML download
        const htmlBuffer = Buffer.from(htmlWithInstructions, "utf8");

        // Clean up temp files
        await fs.rm(tempDir, { recursive: true, force: true });

        // Return HTML as downloadable file (fallback)
        return new NextResponse(htmlBuffer, {
          status: 200,
          headers: {
            "Content-Type": "text/html",
            "Content-Disposition":
              'attachment; filename="heart-rush-rulebook.html"',
            "Content-Length": htmlBuffer.length.toString(),
          },
        });
      }
    } catch (error) {
      console.error("Error reading HTML:", error);
      await fs.rm(tempDir, { recursive: true, force: true });
      return NextResponse.json(
        { success: false, error: "Failed to read generated HTML" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error generating PDF data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate PDF data" },
      { status: 500 }
    );
  }
}
