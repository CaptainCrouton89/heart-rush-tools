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
      setLoading(true);

      // Determine endpoint based on context (world > GM > regular)
      let endpoint: string;
      const worldMatch = pathname.match(/^\/world\/([^/]+)\//);

      if (worldMatch) {
        const world = worldMatch[1];
        endpoint = `/api/world/${world}/breadcrumbs/${slug}`;
      } else if (pathname.startsWith('/gm/') || isGMMode) {
        endpoint = `/api/gm/breadcrumbs/${slug}`;
      } else {
        endpoint = `/api/breadcrumbs?slug=${slug}`;
      }

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch breadcrumbs from ${endpoint}: ${response.statusText}`);
      }
      const crumbs = await response.json();
      setBreadcrumbs(crumbs);
      setLoading(false);
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

  // Determine link prefix based on context (world > GM > regular)
  const worldMatch = pathname.match(/^\/world\/([^/]+)\//);
  const linkPrefix = worldMatch
    ? `/world/${worldMatch[1]}`
    : pathname.startsWith('/gm/') || isGMMode
    ? '/gm'
    : '';

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm text-muted-foreground">
      <Link
        href="/"
        className="hover:text-foreground transition-colors"
      >
        Home
      </Link>

      {worldMatch && (
        <>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground/80 font-medium">
            {worldMatch[1].charAt(0).toUpperCase() + worldMatch[1].slice(1)}
          </span>
        </>
      )}

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