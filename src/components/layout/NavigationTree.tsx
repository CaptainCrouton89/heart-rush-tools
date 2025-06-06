'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavigationNode } from '../../types/content';

interface NavigationTreeProps {
  nodes: NavigationNode[];
  onNavigate?: () => void;
  level?: number;
}

interface NavigationItemProps {
  node: NavigationNode;
  onNavigate?: () => void;
  level: number;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

function NavigationItem({ 
  node, 
  onNavigate, 
  level, 
  isActive, 
  isOpen, 
  onToggle 
}: NavigationItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const indent = level * 32; // Much larger indentation for clear hierarchy

  const handleItemClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking the expand/collapse button
    if ((e.target as Element).closest('button')) {
      return;
    }
    
    // Always allow navigation - let the Link handle it
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <div>
      <Link
        href={`/${node.slug}`}
        onClick={handleItemClick}
        className={`
          flex items-center py-2 px-2 rounded-md text-sm block
          ${isActive 
            ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100' 
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }
        `}
        style={{ paddingLeft: indent + 8 }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle();
            }}
            className="mr-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label={isOpen ? 'Collapse section' : 'Expand section'}
          >
            <svg 
              className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        
        <span
          className={`
            flex-1 truncate
            ${!hasChildren ? 'ml-5' : ''}
          `}
        >
          {node.title}
        </span>
      </Link>

      {hasChildren && isOpen && node.children && (
        <NavigationTree 
          nodes={node.children} 
          onNavigate={onNavigate}
          level={level + 1}
        />
      )}
    </div>
  );
}

export function NavigationTree({ nodes, onNavigate, level = 0 }: NavigationTreeProps) {
  const pathname = usePathname();
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());

  const toggleNode = (slug: string) => {
    setOpenNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slug)) {
        newSet.delete(slug);
      } else {
        newSet.add(slug);
      }
      return newSet;
    });
  };

  // Auto-open nodes in active path
  useEffect(() => {
    const isInActivePath = (node: NavigationNode): boolean => {
      if (pathname === `/${node.slug}`) return true;
      if (node.children) {
        return node.children.some(child => isInActivePath(child));
      }
      return false;
    };

    const findActivePath = (nodes: NavigationNode[]): string[] => {
      for (const node of nodes) {
        if (isInActivePath(node)) {
          if (node.children && node.children.some(child => isInActivePath(child))) {
            return [node.slug, ...findActivePath(node.children)];
          }
          return [node.slug];
        }
      }
      return [];
    };

    const activePath = findActivePath(nodes);
    setOpenNodes(prev => new Set([...prev, ...activePath]));
  }, [pathname, nodes]);

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <NavigationItem
          key={node.slug}
          node={node}
          onNavigate={onNavigate}
          level={level}
          isActive={pathname === `/${node.slug}`}
          isOpen={openNodes.has(node.slug)}
          onToggle={() => toggleNode(node.slug)}
        />
      ))}
    </div>
  );
}