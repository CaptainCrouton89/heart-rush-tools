'use client';

import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote';
import { serialize } from 'next-mdx-remote/serialize';
import { useState, useEffect } from 'react';
import { CrossReferenceLink } from './CrossReferenceLink';

interface MarkdownRendererProps {
  content: string;
}

// Type for component props
interface ComponentProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

// Custom components for MDX rendering
const mdxComponents = {
  // Override default link component with cross-reference logic
  a: CrossReferenceLink,
  
  // Custom heading components with proper IDs for ToC
  h1: ({ children, ...props }: ComponentProps) => {
    const id = typeof children === 'string' 
      ? children.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      : '';
    return <h1 id={id} className="text-3xl font-bold mb-6 text-gray-900 dark:text-white" {...props}>{children}</h1>;
  },
  
  h2: ({ children, ...props }: ComponentProps) => {
    const id = typeof children === 'string' 
      ? children.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      : '';
    return <h2 id={id} className="text-2xl font-semibold mb-4 mt-8 text-gray-900 dark:text-white" {...props}>{children}</h2>;
  },
  
  h3: ({ children, ...props }: ComponentProps) => {
    const id = typeof children === 'string' 
      ? children.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      : '';
    return <h3 id={id} className="text-xl font-semibold mb-3 mt-6 text-gray-900 dark:text-white" {...props}>{children}</h3>;
  },
  
  h4: ({ children, ...props }: ComponentProps) => {
    const id = typeof children === 'string' 
      ? children.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      : '';
    return <h4 id={id} className="text-lg font-semibold mb-2 mt-4 text-gray-900 dark:text-white" {...props}>{children}</h4>;
  },
  
  // Enhanced paragraph styling
  p: ({ children, ...props }: ComponentProps) => (
    <p className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed" {...props}>{children}</p>
  ),
  
  // Enhanced list styling
  ul: ({ children, ...props }: ComponentProps) => (
    <ul className="list-disc list-inside mb-4 text-gray-700 dark:text-gray-300 space-y-1" {...props}>{children}</ul>
  ),
  
  ol: ({ children, ...props }: ComponentProps) => (
    <ol className="list-decimal list-inside mb-4 text-gray-700 dark:text-gray-300 space-y-1" {...props}>{children}</ol>
  ),
  
  li: ({ children, ...props }: ComponentProps) => (
    <li className="ml-2" {...props}>{children}</li>
  ),
  
  // Enhanced table styling
  table: ({ children, ...props }: ComponentProps) => (
    <div className="overflow-x-auto mb-6">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg" {...props}>
        {children}
      </table>
    </div>
  ),
  
  thead: ({ children, ...props }: ComponentProps) => (
    <thead className="bg-gray-50 dark:bg-gray-800" {...props}>{children}</thead>
  ),
  
  tbody: ({ children, ...props }: ComponentProps) => (
    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700" {...props}>{children}</tbody>
  ),
  
  th: ({ children, ...props }: ComponentProps) => (
    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" {...props}>{children}</th>
  ),
  
  td: ({ children, ...props }: ComponentProps) => (
    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white" {...props}>{children}</td>
  ),
  
  // Code blocks
  pre: ({ children, ...props }: ComponentProps) => (
    <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4 overflow-x-auto text-sm" {...props}>{children}</pre>
  ),
  
  code: ({ children, ...props }: ComponentProps) => (
    <code className="bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 px-1 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
  ),
  
  // Blockquotes
  blockquote: ({ children, ...props }: ComponentProps) => (
    <blockquote className="border-l-4 border-blue-500 pl-4 mb-4 italic text-gray-600 dark:text-gray-400" {...props}>{children}</blockquote>
  ),
  
  // Horizontal rules
  hr: (props: ComponentProps) => (
    <hr className="my-8 border-gray-200 dark:border-gray-700" {...props} />
  ),
  
  // Strong and emphasis
  strong: ({ children, ...props }: ComponentProps) => (
    <strong className="font-semibold text-gray-900 dark:text-white" {...props}>{children}</strong>
  ),
  
  em: ({ children, ...props }: ComponentProps) => (
    <em className="italic text-gray-700 dark:text-gray-300" {...props}>{children}</em>
  ),
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [mdxSource, setMdxSource] = useState<MDXRemoteSerializeResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processMarkdown = async () => {
      try {
        setIsLoading(true);
        const serialized = await serialize(content, {
          mdxOptions: {
            remarkPlugins: [],
            rehypePlugins: [],
          },
        });
        setMdxSource(serialized);
        setError(null);
      } catch (err) {
        console.error('Failed to process markdown:', err);
        setError('Failed to render content');
      } finally {
        setIsLoading(false);
      }
    };

    processMarkdown();
  }, [content]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
      </div>
    );
  }

  if (error || !mdxSource) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">
          {error || 'Failed to load content'}
        </p>
      </div>
    );
  }

  return (
    <div className="prose-content max-w-none">
      <MDXRemote {...mdxSource} components={mdxComponents} />
    </div>
  );
}