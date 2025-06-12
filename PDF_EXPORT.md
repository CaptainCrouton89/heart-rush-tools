# PDF Export System

## Overview
Comprehensive PDF generation system that converts the complete Heart Rush digital rulebook into downloadable PDF format. Handles complex formatting, table layouts, Unicode character processing, and maintains proper document structure for print and digital distribution.

## How It Works
1. **Content Aggregation**: Collects all compiled content sections in proper order
2. **Text Processing**: Cleans and formats markdown content for PDF rendering
3. **Layout Generation**: Creates structured PDF with headers, footers, and page breaks
4. **Table Formatting**: Handles complex game tables with auto-table generation
5. **Download Delivery**: Streams generated PDF to user for download

## Key Files
- **`src/components/PDFDownloadButton.tsx`** - PDF download trigger component
- **`src/app/api/pdf-download/route.ts`** - PDF generation API endpoint
- **PDF Dependencies**: jsPDF, jsPDF-AutoTable for table handling

## PDF Generation Pipeline
### Content Collection
```typescript
// Aggregates all content in proper order
const allContent = await getAllContentSections();
const sortedContent = allContent.sort((a, b) => a.order - b.order);
```

### Text Processing
```typescript
// Cleans content for PDF compatibility
function cleanTextForPDF(text: string): string {
  return text
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
    .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
    .trim();
}
```

### Document Structure
```typescript
interface PDFDocument {
  title: "Heart Rush Digital Rulebook";
  metadata: DocumentMetadata;
  sections: PDFSection[];
  tableOfContents: boolean;
  pageNumbers: boolean;
}
```

## Content Processing
### Markdown to PDF Conversion
- **Header Processing**: Converts markdown headers to PDF headings
- **Text Formatting**: Handles bold, italic, and special formatting
- **List Processing**: Converts markdown lists to formatted PDF lists
- **Unicode Cleaning**: Removes problematic Unicode characters for PDF compatibility
- **Line Break Handling**: Proper paragraph and section spacing

### Table Handling
```typescript
// Auto-table generation for game tables
function processTable(markdownTable: string) {
  const rows = parseMarkdownTable(markdownTable);
  doc.autoTable({
    head: [rows[0]], // Header row
    body: rows.slice(1), // Data rows
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [41, 128, 185] }
  });
}
```

### Special Content Types
- **Stat Blocks**: Game character/monster statistics
- **Rule Callouts**: Highlighted rule explanations
- **Example Boxes**: Formatted example scenarios
- **Reference Tables**: Lookup tables with proper formatting

## Document Layout
### Page Structure
- **Header**: Document title and section information
- **Footer**: Page numbers and document info
- **Margins**: Appropriate margins for printing and binding
- **Font Selection**: PDF-compatible fonts with fallbacks
- **Page Breaks**: Intelligent section breaks

### Section Organization
```typescript
interface PDFSection {
  title: string;
  level: number; // Header level (1-6)
  content: string;
  pageStart?: number;
  subsections?: PDFSection[];
}
```

### Table of Contents
- **Auto-generation**: TOC built from section headers
- **Page References**: Links to specific page numbers
- **Nested Structure**: Multi-level TOC matching content hierarchy
- **Clickable Links**: Interactive TOC in digital PDF

## Performance Optimizations
### Streaming Generation
- **Chunked Processing**: Large documents processed in chunks
- **Memory Management**: Efficient memory usage for large PDFs
- **Progress Feedback**: User feedback during generation
- **Error Recovery**: Graceful handling of generation failures

### Content Optimization
- **Image Compression**: Optimized images for smaller file size
- **Font Subsetting**: Include only necessary font characters
- **Content Filtering**: Option to exclude certain sections
- **Compression**: PDF compression for smaller downloads

## User Experience
### Download Interface
```typescript
interface PDFDownloadProps {
  buttonText?: string;
  includeGMContent?: boolean;
  customSections?: string[];
  filename?: string;
}
```

### Progress Indication
- **Loading States**: Clear indication during PDF generation
- **Progress Bar**: Shows generation progress for large documents
- **Estimated Time**: Time estimates for completion
- **Cancel Option**: Ability to cancel long-running operations

### Error Handling
- **Generation Failures**: Clear error messages for failed generation
- **Content Issues**: Handling of problematic content sections
- **Download Failures**: Retry mechanisms for failed downloads
- **Fallback Options**: Alternative export formats if PDF fails

## Customization Options
### Content Selection
- **Full Rulebook**: Complete document with all sections
- **Player Edition**: Player-only content without GM materials
- **GM Supplement**: GM-only content as separate document
- **Custom Compilation**: User-selected sections only

### Formatting Options
- **Page Size**: A4, Letter, and other standard sizes
- **Font Size**: Adjustable text size for accessibility
- **Margin Settings**: Customizable margins for different use cases
- **Color Options**: Black & white or color printing options

### Metadata Configuration
```typescript
interface PDFMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
}
```

## Technical Implementation
### jsPDF Configuration
```typescript
const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
  compress: true
});

// AutoTable plugin for complex tables
doc.autoTable({
  theme: 'grid',
  styles: {
    fontSize: 10,
    cellPadding: 3,
    overflow: 'linebreak'
  }
});
```

### Memory Management
- **Large Document Handling**: Efficient processing of large content
- **Garbage Collection**: Proper cleanup of temporary objects
- **Stream Processing**: Process content without loading everything into memory
- **Browser Compatibility**: Works across different browsers and devices

## API Endpoint Structure
### Request Format
```typescript
interface PDFGenerationRequest {
  sections?: string[]; // Optional section filtering
  includeGM?: boolean; // Include GM content
  format?: 'a4' | 'letter'; // Page format
  options?: PDFOptions; // Additional formatting options
}
```

### Response Handling
- **Binary Stream**: PDF returned as binary data stream
- **Content Headers**: Proper MIME types and download headers
- **Filename Generation**: Automatic filename with timestamp
- **Error Responses**: Structured error messages for failures

## Quality Assurance
### Content Validation
- **Completeness Check**: Ensure all selected content is included
- **Formatting Validation**: Verify proper PDF formatting
- **Table Integrity**: Confirm table layouts are preserved
- **Cross-reference Handling**: Manage internal document links

### Testing
- **Content Accuracy**: Generated PDF matches source content
- **Layout Testing**: PDF layout works across different viewers
- **Performance Testing**: Generation time for various document sizes
- **Browser Compatibility**: Testing across different browsers

## Future Enhancements
### Planned Features
- **Interactive PDFs**: Clickable cross-references and navigation
- **Bookmarking**: PDF bookmarks for section navigation
- **Form Fields**: Fillable character sheets and forms
- **Print Optimization**: Enhanced layouts specifically for printing

### Advanced Options
- **Multi-language Support**: PDFs in different languages
- **Custom Styling**: User-defined PDF themes and styling
- **Batch Export**: Generate multiple PDFs with different configurations
- **Cloud Storage**: Direct export to cloud storage services

## Development Notes
- PDF generation happens server-side for performance and reliability
- Unicode handling is critical for proper text rendering
- Table processing requires special handling for complex game tables
- Memory usage monitoring important for large document generation