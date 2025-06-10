"use client";

import { useState } from "react";
import { ContentSection } from "../types/content";

// Simple jsPDF interface without autoTable
interface SimplePDF {
  internal: {
    pageSize: {
      getWidth(): number;
      getHeight(): number;
    };
  };
  setFontSize(size: number): void;
  setFont(fontName: string, fontStyle: string): void;
  splitTextToSize(text: string, maxWidth: number): string[];
  text(text: string | string[], x: number, y: number): void;
  addPage(): void;
  save(filename: string): void;
  setDrawColor(r: number, g: number, b: number): void;
  setFillColor(r: number, g: number, b: number): void;
  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    style?: string
  ): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  getTextWidth(text: string): number;
}

interface PDFCategory {
  type: "category";
  name: string;
  sections: ContentSection[];
}

interface PDFData {
  success: boolean;
  data: PDFCategory[];
  title: string;
}

export function PDFDownloadButton() {
  const [isGenerating, setIsGenerating] = useState(false);

  // Helper function to clean Unicode characters that cause spacing issues in jsPDF
  const cleanUnicodeText = (text: string): string => {
    return text
      .replace(/→/g, "->") // Replace arrow with ASCII equivalent
      .replace(/[""]/g, '"') // Replace smart quotes with regular quotes
      .replace(/['']/g, "'") // Replace smart apostrophes with regular apostrophes
      .replace(/[–—]/g, "-") // Replace em/en dashes with hyphens
      .replace(/[…]/g, "...") // Replace ellipsis with three dots
      .replace(/≥/g, ">=") // Replace greater than or equal
      .replace(/≤/g, "<=") // Replace less than or equal
      .replace(/≠/g, "!=") // Replace not equal
      .replace(/×/g, "x") // Replace multiplication sign
      .replace(/÷/g, "/") // Replace division sign
      .replace(/±/g, "+/-") // Replace plus-minus
      .replace(/°/g, " degrees"); // Replace degree symbol
  };

  const drawTable = (
    pdf: SimplePDF,
    headers: string[],
    rows: string[][],
    startX: number,
    startY: number,
    maxWidth: number,
    pageHeight: number,
    margin: number
  ) => {
    const colCount = headers.length;
    const colWidth = maxWidth / colCount;
    const rowHeight = 8;
    let currentY = startY;

    // Set table styling
    pdf.setDrawColor(0, 0, 0);
    pdf.setFillColor(240, 240, 240);
    pdf.setFontSize(9);

    // Draw header row
    pdf.setFont("helvetica", "bold");

    // Header background
    pdf.rect(startX, currentY, maxWidth, rowHeight, "F");

    // Header text and borders
    for (let i = 0; i < headers.length; i++) {
      const cellX = startX + i * colWidth;
      const textLines = pdf.splitTextToSize(headers[i], colWidth - 2);

      // Draw cell border (stroke only)
      pdf.rect(cellX, currentY, colWidth, rowHeight, "S");

      // Draw text
      const headerText = Array.isArray(textLines[0]) ? textLines[0].join(' ') : (textLines[0] || "");
      pdf.text(headerText, cellX + 1, currentY + 6);
    }

    currentY += rowHeight;

    // Draw data rows
    pdf.setFont("helvetica", "normal");
    pdf.setFillColor(255, 255, 255);

    for (const row of rows) {
      // Check if we need a new page
      if (currentY + rowHeight > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;

        // Redraw header on new page
        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(240, 240, 240);
        pdf.rect(startX, currentY, maxWidth, rowHeight, "F");

        for (let i = 0; i < headers.length; i++) {
          const cellX = startX + i * colWidth;
          const textLines = pdf.splitTextToSize(headers[i], colWidth - 2);
          pdf.rect(cellX, currentY, colWidth, rowHeight, "S");
          const headerText = Array.isArray(textLines[0]) ? textLines[0].join(' ') : (textLines[0] || "");
          pdf.text(headerText, cellX + 1, currentY + 6);
        }

        currentY += rowHeight;
        pdf.setFont("helvetica", "normal");
        pdf.setFillColor(255, 255, 255);
      }

      // Draw cells (no background fill for data rows)
      for (let i = 0; i < Math.min(row.length, headers.length); i++) {
        const cellX = startX + i * colWidth;
        const cellText = row[i] || "";
        const textLines = pdf.splitTextToSize(cellText, colWidth - 2);

        // Draw cell border (stroke only, no fill)
        pdf.rect(cellX, currentY, colWidth, rowHeight, "S");

        // Draw text (only first line if too long)
        const cellTextLine = Array.isArray(textLines[0]) ? textLines[0].join(' ') : (textLines[0] || "");
        pdf.text(cellTextLine, cellX + 1, currentY + 6);
      }

      currentY += rowHeight;
    }

    return currentY + 6; // Add some space after table
  };

  const processContentWithTables = (
    content: string,
    pdf: SimplePDF,
    xPosition: number,
    maxWidth: number,
    startY: number,
    pageHeight: number,
    margin: number
  ) => {
    let yPosition = startY;

    // Split content by tables
    const tableRegex = /^\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm;
    const parts: Array<{
      type: string;
      content?: string;
      headers?: string[];
      rows?: string[][];
    }> = [];
    let lastIndex = 0;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      // Add text before table
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: content.substring(lastIndex, match.index),
        });
      }

      // Add table
      const headerRow = match[1];
      const bodyRows = match[2];

      // Parse headers
      const headers = headerRow
        .split("|")
        .map((h) => cleanUnicodeText(h.trim()))
        .filter((h) => h);

      // Parse body rows
      const rows = bodyRows
        .trim()
        .split("\n")
        .map((row) =>
          row
            .split("|")
            .map((cell) => cleanUnicodeText(cell.trim()))
            .filter((cell) => cell)
        )
        .filter((row) => row.length > 0);

      parts.push({
        type: "table",
        headers,
        rows,
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        content: content.substring(lastIndex),
      });
    }

    // Process each part
    for (const part of parts) {
      if (part.type === "text" && part.content) {
        // Clean and format regular text
        let cleanText = part.content
          .replace(/#{1,6}\s*(.+)/g, "$1") // Convert headers to plain text
          .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
          .replace(/\*([^*]+)\*/g, "$1") // Remove italic markdown
          .replace(/`([^`]+)`/g, "$1") // Remove inline code formatting
          .replace(/```[^`]*```/g, "[Code Block]") // Replace code blocks
          .replace(/\[(.*?)\]\([^)]*\)/g, "$1") // Convert links to text only
          .replace(/^\s*[-*+]\s+/gm, "• ") // Convert markdown lists to bullet points
          .replace(/^\s*\d+\.\s+/gm, "• ") // Convert numbered lists to bullet points
          .replace(/\n{3,}/g, "\n\n") // Reduce excessive newlines
          .replace(/^\s+|\s+$/gm, "") // Trim each line
          .trim();
        
        // Clean Unicode characters
        cleanText = cleanUnicodeText(cleanText);

        if (cleanText) {
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");

          const textLines = pdf.splitTextToSize(cleanText, maxWidth);

          for (let i = 0; i < textLines.length; i++) {
            if (yPosition + 5 > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }

            // Ensure we're passing a string, not an array
            const lineText = Array.isArray(textLines[i]) ? textLines[i].join(' ') : textLines[i];
            pdf.text(lineText, xPosition, yPosition);
            yPosition += 4;
          }

          yPosition += 6; // Space after text block
        }
      } else if (part.type === "table" && part.headers && part.rows) {
        // Check if we need a new page for the table
        const estimatedTableHeight = (part.rows.length + 2) * 8;
        if (yPosition + estimatedTableHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }

        // Draw custom table
        yPosition = drawTable(
          pdf,
          part.headers,
          part.rows,
          xPosition,
          yPosition,
          maxWidth,
          pageHeight,
          margin
        );
      }
    }

    return { finalY: yPosition };
  };

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      // Import only jsPDF - no autoTable plugin needed
      const { default: jsPDF } = await import("jspdf");

      // Fetch the structured content data
      const response = await fetch("/api/pdf-download");
      const pdfData: PDFData = await response.json();

      if (!pdfData.success) {
        throw new Error("Failed to fetch PDF data");
      }

      // Create new PDF document
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      }) as SimplePDF;

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // Add title page
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      const titleLines = pdf.splitTextToSize(pdfData.title, maxWidth);
      
      // Render title lines properly
      for (let i = 0; i < titleLines.length; i++) {
        const titleText = Array.isArray(titleLines[i]) ? titleLines[i].join(' ') : titleLines[i];
        pdf.text(titleText, margin, yPosition + (i * 12));
      }
      yPosition += titleLines.length * 12 + 20;

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text("Complete Digital Rulebook", margin, yPosition);
      yPosition += 10;
      pdf.text(
        `Generated on ${new Date().toLocaleDateString()}`,
        margin,
        yPosition
      );

      // Add new page for content
      pdf.addPage();
      yPosition = margin;

      // Process each category and section
      for (const category of pdfData.data) {
        // Add category header
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");

        // Check if we need a new page for the category
        if (yPosition + 20 > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }

        const categoryLines = pdf.splitTextToSize(category.name, maxWidth);
        
        // Render category lines properly
        for (let i = 0; i < categoryLines.length; i++) {
          const categoryText = Array.isArray(categoryLines[i]) ? categoryLines[i].join(' ') : categoryLines[i];
          pdf.text(categoryText, margin, yPosition + (i * 8));
        }
        yPosition += categoryLines.length * 8 + 10;

        // Add sections within category
        for (const section of category.sections) {
          // Determine section level for appropriate font sizing and indentation
          const sectionLevel = section.level || 1;
          const indent = Math.min(sectionLevel - 1, 3) * 5; // Max indent of 15mm

          // Add section title with appropriate sizing based on level
          const titleFontSize = Math.max(16 - sectionLevel * 2, 10);
          pdf.setFontSize(titleFontSize);
          pdf.setFont("helvetica", "bold");

          // Check if we need a new page for the section
          if (yPosition + 15 > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }

          const sectionTitleLines = pdf.splitTextToSize(
            section.title,
            maxWidth - indent
          );
          
          // Render section title lines properly
          for (let i = 0; i < sectionTitleLines.length; i++) {
            const sectionText = Array.isArray(sectionTitleLines[i]) ? sectionTitleLines[i].join(' ') : sectionTitleLines[i];
            pdf.text(sectionText, margin + indent, yPosition + (i * (titleFontSize * 0.35)));
          }
          yPosition += sectionTitleLines.length * (titleFontSize * 0.35) + 6;

          // Process content to handle tables and regular text separately
          const processedContent = processContentWithTables(
            section.content,
            pdf,
            margin + indent,
            maxWidth - indent,
            yPosition,
            pageHeight,
            margin
          );
          yPosition = processedContent.finalY;

          yPosition += Math.max(8 - sectionLevel, 3); // Less space for deeper sections
        }

        yPosition += 5; // Extra space between categories
      }

      // Save the PDF
      pdf.save("heart-rush-rulebook.pdf");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={isGenerating}
      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-wait font-medium"
    >
      {isGenerating ? (
        <>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Generating PDF...
        </>
      ) : (
        <>
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Download Complete Rulebook (PDF)
        </>
      )}
    </button>
  );
}
