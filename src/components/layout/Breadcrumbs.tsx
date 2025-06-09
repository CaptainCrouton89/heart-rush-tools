'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Breadcrumb } from '../../types/content';
import { useGM } from '../../context/GMContext';

interface BreadcrumbsProps {
  slug: string;
}

export function Breadcrumbs({ slug }: BreadcrumbsProps) {
  const { isGMMode } = useGM();
  const pathname = usePathname();
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBreadcrumbs = async () => {
      try {
        // Determine if we're in GM mode based on pathname or context
        const isCurrentlyGM = pathname.startsWith('/gm/') || isGMMode;
        const endpoint = isCurrentlyGM ? `/api/gm/breadcrumbs/${slug}` : `/api/breadcrumbs?slug=${slug}`;
        
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Failed to fetch breadcrumbs');
        const crumbs = await response.json();
        setBreadcrumbs(crumbs);
      } catch (error) {
        console.error('Failed to load breadcrumbs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBreadcrumbs();
  }, [slug, isGMMode, pathname]);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="h-4 bg-muted rounded w-16 animate-pulse" />
        <span className="text-muted-foreground">/</span>
        <div className="h-4 bg-muted rounded w-24 animate-pulse" />
      </div>
    );
  }

  if (breadcrumbs.length === 0) {
    return null;
  }

  const isCurrentlyGM = pathname.startsWith('/gm/') || isGMMode;
  const linkPrefix = isCurrentlyGM ? '/gm' : '';

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm text-muted-foreground">
      <Link 
        href="/" 
        className="hover:text-foreground transition-colors"
      >
        Home
      </Link>
      
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.slug} className="flex items-center space-x-2">
          <span className="text-muted-foreground">/</span>
          {index === breadcrumbs.length - 1 ? (
            <span className="text-foreground font-medium">
              {crumb.title}
            </span>
          ) : (
            <Link
              href={`${linkPrefix}/${crumb.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {crumb.title}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}