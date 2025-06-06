'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TagBrowser() {
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Load all available tags
    async function fetchTags() {
      try {
        const response = await fetch('/api/tags');
        if (response.ok) {
          const tags = await response.json();
          setAllTags(tags);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    }

    fetchTags();

    // Initialize selected tags from URL params
    const tagsParam = searchParams.get('tags');
    if (tagsParam) {
      setSelectedTags(new Set(tagsParam.split(',')));
    }
  }, [searchParams]);

  const toggleTag = (tag: string) => {
    const newSelectedTags = new Set(selectedTags);
    
    if (newSelectedTags.has(tag)) {
      newSelectedTags.delete(tag);
    } else {
      newSelectedTags.add(tag);
    }
    
    setSelectedTags(newSelectedTags);

    // Navigate to search page with selected tags
    if (newSelectedTags.size > 0) {
      const tagsParam = Array.from(newSelectedTags).join(',');
      router.push(`/search?tags=${encodeURIComponent(tagsParam)}`);
    } else {
      router.push('/');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {allTags.map(tag => {
          const isSelected = selectedTags.has(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`inline-block px-3 py-1 rounded-full text-sm transition-colors ${
                isSelected 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
      
      {selectedTags.size > 0 && (
        <div className="mt-4 p-3 bg-card border border-border rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            Selected tags ({selectedTags.size}):
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedTags).map(tag => (
              <span 
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
              >
                {tag}
                <button 
                  onClick={() => toggleTag(tag)}
                  className="hover:text-primary-foreground/70"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}