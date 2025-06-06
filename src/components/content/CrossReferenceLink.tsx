'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface CrossReferenceLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function CrossReferenceLink({ href, children, className = '' }: CrossReferenceLinkProps) {
  // Handle external links
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline ${className}`}
      >
        {children}
        <ExternalLink size={12} className="inline" />
      </a>
    );
  }

  // Handle anchor links (same page)
  if (href.startsWith('#')) {
    return (
      <a
        href={href}
        className={`text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline ${className}`}
      >
        {children}
      </a>
    );
  }

  // Handle relative links that might need slug resolution
  const resolveSlug = (path: string): string => {
    // Remove .md extension if present
    let resolvedPath = path.replace(/\.md$/, '');
    
    // Remove leading slash if present
    resolvedPath = resolvedPath.replace(/^\//, '');
    
    // Convert spaces and special chars to proper URL format
    resolvedPath = resolvedPath
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');
    
    return resolvedPath;
  };

  // Internal cross-reference link
  const resolvedHref = href.startsWith('/') ? resolveSlug(href) : resolveSlug(`/${href}`);
  
  return (
    <Link
      href={`/${resolvedHref}`}
      className={`text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline ${className}`}
    >
      {children}
    </Link>
  );
}