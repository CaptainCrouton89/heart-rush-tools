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
          flex items-center py-2 px-2 rounded-md text-sm block transition-all duration-200
          ${isActive 
            ? 'bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-sm border-l-2 border-primary' 
            : `text-foreground hover:bg-gradient-to-r hover:from-primary/10 hover:to-accent/10 
               hover:text-primary hover:border-l-2 hover:border-primary/50 hover:shadow-sm
               ${level > 0 ? 'hover:ml-1' : ''}`
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
            className={`mr-2 p-1 rounded transition-all duration-200 
              ${isActive 
                ? 'hover:bg-primary-foreground/20' 
                : 'hover:bg-primary/20 hover:text-primary'
              }`}
            aria-label={isOpen ? 'Collapse section' : 'Expand section'}
          >
            <svg 
              className={`w-3 h-3 transition-all duration-200 ${isOpen ? 'rotate-90 text-primary' : ''}`}
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
            flex-1 truncate font-medium
            ${!hasChildren ? 'ml-5' : ''}
            ${level === 0 ? 'font-semibold' : ''}
            ${level > 1 ? 'text-sm opacity-90' : ''}
          `}
        >
          {node.title}
        </span>
        
        {/* Visual indicator for different levels */}
        {level > 0 && (
          <div className={`w-1 h-1 rounded-full bg-current opacity-30 ml-2`} />
        )}
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