'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ContentMetadata } from '../../types/content';
import TagBrowser from '../../components/TagBrowser';

export default function SearchResults() {
  const searchParams = useSearchParams();
  const tagsParam = searchParams.get('tags');
  const [results, setResults] = useState<ContentMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      if (!tagsParam) {
        setResults([]);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/content/metadata?tags=${encodeURIComponent(tagsParam)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
        }
      } catch (error) {
        console.error('Error fetching search results:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [tagsParam]);

  if (loading) {
    return <div>Loading search results...</div>;
  }

  const selectedTags = tagsParam ? tagsParam.split(',') : [];

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-6">
        {selectedTags.length > 0 ? `Content tagged with: ${selectedTags.join(', ')}` : 'Tag Browser'}
      </h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4">Filter by Tags</h2>
        <TagBrowser />
      </div>

      {tagsParam && (
        <>
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Search Results ({results.length})
          </h2>
          
          {results.length === 0 ? (
            <p className="text-muted-foreground">No content found with the selected tags.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {results.map(item => (
                <div 
                  key={item.slug}
                  className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/30"
                >
                  <h3 className="text-xl font-semibold text-card-foreground mb-3">
                    <Link 
                      href={`/${item.slug}`}
                      className="hover:text-primary transition-colors"
                    >
                      {item.title}
                    </Link>
                  </h3>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="inline-block px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
                      {item.category}
                    </span>
                    {item.tags.map(tag => (
                      <span 
                        key={tag}
                        className={`inline-block px-2 py-1 rounded text-xs ${
                          selectedTags.includes(tag)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-accent text-accent-foreground'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <p className="text-muted-foreground text-sm mb-4">
                    Reading time: {item.readingTime} min
                  </p>
                  
                  <Link 
                    href={`/${item.slug}`}
                    className="inline-block text-primary hover:text-secondary hover:underline text-sm font-medium transition-colors"
                  >
                    Read more →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}