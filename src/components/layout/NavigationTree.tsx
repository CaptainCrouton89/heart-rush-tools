"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useGM } from "../../context/GMContext";
import { CategorizedNavigationNode, NavigationNode } from "../../types/content";

interface NavigationTreeProps {
  nodes: NavigationNode[] | CategorizedNavigationNode[];
  onNavigate?: () => void;
  level?: number;
}

interface NavigationItemProps {
  node: NavigationNode | CategorizedNavigationNode;
  onNavigate?: () => void;
  level: number;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

interface CategoryHeaderProps {
  name: string;
}

function CategoryHeader({ name }: CategoryHeaderProps) {
  return (
    <div className="flex items-center py-3 mb-2">
      <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
        {name}
      </span>
      <div className="flex-1 ml-3 h-px bg-border"></div>
    </div>
  );
}

function NavigationItem({
  node,
  onNavigate,
  level,
  isActive,
  isOpen,
  onToggle,
}: NavigationItemProps) {
  const { isGMMode } = useGM();

  // Handle categorized navigation nodes
  if ("type" in node && node.type === "category") {
    return (
      <div>
        <CategoryHeader name={node.name!} />
        {node.children && node.children.length > 0 && (
          <div className="ml-0 space-y-1">
            <NavigationTree
              nodes={node.children}
              onNavigate={onNavigate}
              level={0}
            />
          </div>
        )}
      </div>
    );
  }

  // Handle regular navigation nodes
  const hasChildren = node.children && node.children.length > 0;
  const indent = level * 32; // Much larger indentation for clear hierarchy
  const nodeSlug = "slug" in node ? node.slug : "";
  const nodeTitle = "title" in node ? node.title : "";

  const handleItemClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking the expand/collapse button
    if ((e.target as Element).closest("button")) {
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
        href={isGMMode ? `/gm/${nodeSlug}` : `/${nodeSlug}`}
        onClick={handleItemClick}
        className={`
          flex items-center py-2 px-2 rounded-md text-sm block transition-all duration-200
          ${
            isActive
              ? "bg-gradient-to-r from-primary/25 to-accent/20 text-primary shadow-sm border-l-2 border-primary"
              : `text-foreground hover:bg-gradient-to-r hover:from-primary/10 hover:to-accent/10 
               hover:text-primary hover:border-l-2 hover:border-primary/50 hover:shadow-sm
               ${level > 0 ? "hover:ml-1" : ""}`
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
              ${
                isActive
                  ? "hover:bg-primary-foreground/20"
                  : "hover:bg-primary/20 hover:text-primary"
              }`}
            aria-label={isOpen ? "Collapse section" : "Expand section"}
          >
            <svg
              className={`w-3 h-3 transition-all duration-200 ${
                isOpen ? "rotate-90 text-primary" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        <span
          className={`
            flex-1 truncate font-medium
            ${!hasChildren ? "ml-5" : ""}
            ${level === 0 ? "font-semibold" : ""}
            ${level > 1 ? "text-sm opacity-90" : ""}
          `}
        >
          {nodeTitle}
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

export function NavigationTree({
  nodes,
  onNavigate,
  level = 0,
}: NavigationTreeProps) {
  const pathname = usePathname();
  const { isGMMode } = useGM();
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());

  const toggleNode = (slug: string) => {
    setOpenNodes((prev) => {
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
    const isInActivePath = (
      node: NavigationNode | CategorizedNavigationNode
    ): boolean => {
      if ("type" in node && node.type === "category") {
        if (node.children) {
          return node.children.some((child) => isInActivePath(child));
        }
        return false;
      }

      const nodeSlug = "slug" in node ? node.slug : "";
      const expectedPath = isGMMode ? `/gm/${nodeSlug}` : `/${nodeSlug}`;
      if (pathname === expectedPath) return true;
      if (node.children) {
        return node.children.some((child) => isInActivePath(child));
      }
      return false;
    };

    const findActivePath = (
      nodes: (NavigationNode | CategorizedNavigationNode)[]
    ): string[] => {
      for (const node of nodes) {
        if (isInActivePath(node)) {
          if ("type" in node && node.type === "category") {
            if (node.children) {
              return findActivePath(node.children);
            }
          } else {
            const nodeSlug = "slug" in node ? node.slug : "";
            if (
              node.children &&
              node.children.some((child) => isInActivePath(child))
            ) {
              return nodeSlug
                ? [nodeSlug, ...findActivePath(node.children)]
                : findActivePath(node.children);
            }
            return nodeSlug ? [nodeSlug] : [];
          }
        }
      }
      return [];
    };

    const activePath = findActivePath(nodes);
    setOpenNodes((prev) => new Set([...prev, ...activePath]));
  }, [pathname, nodes, isGMMode]);

  return (
    <div className="space-y-1">
      {nodes.map((node, index) => {
        const key =
          "type" in node && node.type === "category"
            ? `category-${node.name}-${index}`
            : "slug" in node
            ? node.slug
            : `node-${index}`;

        const nodeSlug = "slug" in node ? node.slug : "";

        return (
          <NavigationItem
            key={key}
            node={node}
            onNavigate={onNavigate}
            level={level}
            isActive={Boolean(
              nodeSlug &&
                pathname === (isGMMode ? `/gm/${nodeSlug}` : `/${nodeSlug}`)
            )}
            isOpen={nodeSlug ? openNodes.has(nodeSlug) : false}
            onToggle={() => nodeSlug && toggleNode(nodeSlug)}
          />
        );
      })}
    </div>
  );
}
