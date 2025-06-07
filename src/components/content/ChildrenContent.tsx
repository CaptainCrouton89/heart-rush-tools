"use client";

import { useState } from "react";
import { ContentSection } from "../../types/content";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface ChildrenContentProps {
  sections: ContentSection[];
  level?: number;
}

interface ChildSectionProps {
  child: ContentSection;
  level: number;
}

function ChildSection({ child, level }: ChildSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Determine header tag based on nesting level (h2 -> h6)
  const headerLevel = Math.min(level + 2, 6);
  const HeaderTag = `h${headerLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  
  // Calculate text size based on level
  const getHeaderSize = (level: number) => {
    switch (level) {
      case 0: return "text-2xl";
      case 1: return "text-xl";
      case 2: return "text-lg";
      case 3: return "text-base";
      default: return "text-sm";
    }
  };

  const headerSize = getHeaderSize(level);
  const hasChildren = child.children && child.children.length > 0;

  if (hasChildren) {
    // Section with children - collapsible
    return (
      <section className="mb-2">
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="cursor-pointer py-1 px-3 rounded-md transition-colors duration-300 hover:bg-accent/10"
        >
          <HeaderTag className={`${headerSize} font-semibold text-primary mb-2`}>
            {child.title}
          </HeaderTag>
          
          <div className="prose prose-lg dark:prose-invert max-w-none mb-2">
            <MarkdownRenderer content={child.content} />
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            
            <span>
              {isExpanded ? 'Hide subsections' : 'Show subsections'}
            </span>
          </div>
        </div>
        
        {/* Show nested children when expanded */}
        <div 
          className={`transition-all duration-500 ease-in-out overflow-hidden ${
            isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="py-2 border-t border-border/20">
            <ChildrenContent sections={child.children!} level={level + 1} />
          </div>
        </div>
      </section>
    );
  } else {
    // Section without children - simple display
    return (
      <section className="mb-2">
        <div className="py-1 px-3">
          <HeaderTag className={`${headerSize} font-semibold text-primary mb-2`}>
            {child.title}
          </HeaderTag>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <MarkdownRenderer content={child.content} />
          </div>
        </div>
      </section>
    );
  }
}

export function ChildrenContent({ sections, level = 0 }: ChildrenContentProps) {
  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      {sections.map((child) => (
        <ChildSection key={child.slug} child={child} level={level} />
      ))}
    </div>
  );
}