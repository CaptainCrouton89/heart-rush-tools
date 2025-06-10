import { NextResponse } from 'next/server';
import { getAllContent, getAllContentMetadata } from '../../../lib/content';
import { ContentSection } from '../../../types/content';

export async function GET() {
  try {
    // Read navigation categories to determine order
    const fs = await import('fs');
    const path = await import('path');
    
    const categoriesPath = path.join(process.cwd(), 'navigation-categories.json');
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    
    // Get ALL content sections and metadata
    const allContent = await getAllContent();
    const allMetadata = await getAllContentMetadata();
    
    // Create maps for easy lookup
    const contentMap = new Map(allContent.map(c => [c.slug, c]));
    
    // Helper function to find content by section name from navigation-categories.json
    const findContentByName = (sectionName: string): ContentSection[] => {
      const results: ContentSection[] = [];
      
      // Try different matching strategies
      const normalizedName = sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const possibleSlugs = [
        normalizedName,
        sectionName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
        sectionName.toLowerCase().replace(/\s+/g, '-')
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
          if (slug.includes(normalizedName) || content.title.toLowerCase().includes(sectionName.toLowerCase())) {
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
        .filter(m => m.parent === parentSlug)
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
        type: 'category',
        name: category.name,
        sections: [] as ContentSection[]
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
    
    return NextResponse.json({ 
      success: true, 
      data: sectionsWithContent,
      title: 'Heart Rush Digital Rulebook'
    });
    
  } catch (error) {
    console.error('Error generating PDF data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF data' },
      { status: 500 }
    );
  }
}