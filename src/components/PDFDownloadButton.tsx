"use client";

import { useState } from "react";

export function PDFDownloadButton() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      // Fetch the PDF directly from the API
      const response = await fetch("/api/pdf-download");
      
      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      // Get the blob from the response
      const blob = await response.blob();
      const contentType = response.headers.get('content-type');
      
      // Determine file type based on content type
      const isHtml = contentType?.includes('text/html');
      
      if (isHtml) {
        // For HTML, open in new tab with auto-print
        const htmlText = await blob.text();
        
        // Add auto-print script to the HTML
        const printScript = `
          <script>
            window.addEventListener('load', function() {
              // Small delay to ensure everything is loaded
              setTimeout(function() {
                window.print();
              }, 1000);
            });
          </script>
        `;
        
        // Insert the script before the closing body tag
        const modifiedHtml = htmlText.replace('</body>', printScript + '</body>');
        
        // Create a blob with the modified HTML
        const modifiedBlob = new Blob([modifiedHtml], { type: 'text/html' });
        const url = window.URL.createObjectURL(modifiedBlob);
        
        // Open in new tab
        window.open(url, '_blank');
        
        // Clean up the URL after a delay
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 5000);
        
        // Optional: Show a brief message (removed since it's obvious from the action)
      } else {
        // For PDF, download directly
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'heart-rush-rulebook.pdf';
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
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
          Generating PDF... (This may take up to 60 seconds)
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
          Generate PDF Rulebook
        </>
      )}
    </button>
  );
}
