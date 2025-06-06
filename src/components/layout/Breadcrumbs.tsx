'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Breadcrumb } from '../../types/content';

interface BreadcrumbsProps {
  slug: string;
}

export function Breadcrumbs({ slug }: BreadcrumbsProps) {
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBreadcrumbs = async () => {
      try {
        // Fetch breadcrumbs from API route instead of direct import
        const response = await fetch(`/api/breadcrumbs?slug=${slug}`);
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
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
        <span className="text-gray-400">/</span>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
      </div>
    );
  }

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
      <Link 
        href="/" 
        className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        Home
      </Link>
      
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.slug} className="flex items-center space-x-2">
          <span className="text-gray-400 dark:text-gray-500">/</span>
          {index === breadcrumbs.length - 1 ? (
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {crumb.title}
            </span>
          ) : (
            <Link
              href={`/${crumb.slug}`}
              className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              {crumb.title}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}