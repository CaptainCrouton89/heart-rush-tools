'use client';

import { useState, useEffect } from 'react';
import { TocEntry } from '../../types/content';

interface TableOfContentsProps {
  content: string;
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const [tocEntries, setTocEntries] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // Parse headings from content
  useEffect(() => {
    const parseHeadings = (content: string): TocEntry[] => {
      const headingRegex = /^(#{1,6})\s+(.+)$/gm;
      const entries: TocEntry[] = [];
      let match;

      while ((match = headingRegex.exec(content)) !== null) {
        const level = match[1].length;
        const title = match[2].trim();
        const anchor = title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');

        entries.push({
          slug: anchor,
          title,
          level,
          anchor: `#${anchor}`
        });
      }

      return entries;
    };

    const entries = parseHeadings(content);
    setTocEntries(entries);
  }, [content]);

  // Track active heading
  useEffect(() => {
    const handleScroll = () => {
      const headings = tocEntries.map(entry => 
        document.querySelector(`[id="${entry.slug}"]`)
      ).filter(Boolean);

      let activeHeading = '';
      
      for (let i = headings.length - 1; i >= 0; i--) {
        const heading = headings[i] as HTMLElement;
        if (heading && heading.offsetTop <= window.scrollY + 100) {
          activeHeading = heading.id;
          break;
        }
      }

      setActiveId(activeHeading);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [tocEntries]);

  if (tocEntries.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-20">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Table of Contents
        </h3>
        
        <nav className="space-y-1">
          {tocEntries.map((entry) => (
            <a
              key={entry.slug}
              href={entry.anchor}
              className={`
                block text-sm transition-colors
                ${activeId === entry.slug
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
              style={{ paddingLeft: (entry.level - 1) * 12 }}
            >
              {entry.title}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}