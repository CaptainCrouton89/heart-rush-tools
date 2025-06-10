"use client";

import { useState } from 'react';
import jsPDF from 'jspdf';
import { ContentSection } from '../types/content';

interface PDFCategory {
  type: 'category';
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

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      // Fetch the structured content data
      const response = await fetch('/api/pdf-download');
      const pdfData: PDFData = await response.json();
      
      if (!pdfData.success) {
        throw new Error('Failed to fetch PDF data');
      }

      // Create new PDF document
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      // Add title page
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      const titleLines = pdf.splitTextToSize(pdfData.title, maxWidth);
      pdf.text(titleLines, margin, yPosition);
      yPosition += titleLines.length * 12 + 20;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Complete Digital Rulebook', margin, yPosition);
      yPosition += 10;
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, margin, yPosition);

      // Add new page for content
      pdf.addPage();
      yPosition = margin;

      // Process each category and section
      for (const category of pdfData.data) {
        // Add category header
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        
        // Check if we need a new page for the category
        if (yPosition + 20 > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        
        const categoryLines = pdf.splitTextToSize(category.name, maxWidth);
        pdf.text(categoryLines, margin, yPosition);
        yPosition += categoryLines.length * 8 + 10;

        // Add sections within category
        for (const section of category.sections) {
          // Determine section level for appropriate font sizing and indentation
          const sectionLevel = section.level || 1;
          const indent = Math.min(sectionLevel - 1, 3) * 5; // Max indent of 15mm
          
          // Add section title with appropriate sizing based on level
          const titleFontSize = Math.max(16 - (sectionLevel * 2), 10);
          pdf.setFontSize(titleFontSize);
          pdf.setFont('helvetica', 'bold');
          
          // Check if we need a new page for the section
          if (yPosition + 15 > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          
          const sectionTitleLines = pdf.splitTextToSize(section.title, maxWidth - indent);
          pdf.text(sectionTitleLines, margin + indent, yPosition);
          yPosition += sectionTitleLines.length * (titleFontSize * 0.35) + 6;

          // Add section content
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          
          // Clean and format the content - preserve more structure
          const cleanContent = section.content
            .replace(/#{1,6}\s*(.+)/g, '$1') // Convert headers to plain text but keep content
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
            .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
            .replace(/`([^`]+)`/g, '$1') // Remove inline code formatting
            .replace(/```[^`]*```/g, '[Code Block]') // Replace code blocks with placeholder
            .replace(/\[(.*?)\]\([^)]*\)/g, '$1') // Convert links to text only
            .replace(/^\s*[-*+]\s+/gm, '• ') // Convert markdown lists to bullet points
            .replace(/^\s*\d+\.\s+/gm, '• ') // Convert numbered lists to bullet points
            .replace(/\n{3,}/g, '\n\n') // Reduce excessive newlines
            .replace(/^\s+|\s+$/gm, '') // Trim each line
            .trim();

          if (cleanContent) {
            const contentLines = pdf.splitTextToSize(cleanContent, maxWidth - indent);
            
            for (let i = 0; i < contentLines.length; i++) {
              if (yPosition + 5 > pageHeight - margin) {
                pdf.addPage();
                yPosition = margin;
              }
              
              pdf.text(contentLines[i], margin + indent, yPosition);
              yPosition += 4;
            }
          }
          
          yPosition += Math.max(8 - sectionLevel, 3); // Less space for deeper sections
        }
        
        yPosition += 5; // Extra space between categories
      }

      // Save the PDF
      pdf.save('heart-rush-rulebook.pdf');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
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
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Complete Rulebook (PDF)
        </>
      )}
    </button>
  );
}