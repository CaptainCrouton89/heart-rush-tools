"use client";

import Link from "next/link";
import { ContentMetadata, ContentSection } from "../../types/content";
import { MarkdownRenderer } from "../content/MarkdownRenderer";
import { ChildrenContent } from "../content/ChildrenContent";
import { Breadcrumbs } from "./Breadcrumbs";
import { TableOfContents } from "./TableOfContents";

interface MainContentProps {
  content: ContentSection;
  previousContent: ContentMetadata | null;
  nextContent: ContentMetadata | null;
  childContent?: ContentSection[];
}

export function MainContent({
  content,
  previousContent,
  nextContent,
  childContent = [],
}: MainContentProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs slug={content.slug} />
        </div>

        {/* Main article content */}
        <article className="prose prose-lg dark:prose-invert max-w-none">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-primary mb-4">
              {content.title}
            </h1>

            {/* Content metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded">
                {content.category}
              </span>
            </div>

            {/* Tags */}
            {content.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {content.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-accent text-accent-foreground px-2 py-1 rounded text-xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Rendered content */}
          <div className="prose-headings:scroll-mt-20">
            <MarkdownRenderer content={content.content} />
          </div>
          
          {/* Child content sections */}
          <ChildrenContent sections={childContent} />
        </article>

        {/* Navigation footer */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex justify-between items-center">
            {previousContent ? (
              <Link
                href={`/${previousContent.slug}`}
                className="text-primary hover:text-primary/80 hover:underline text-sm flex items-center gap-1 group"
              >
                <span className="group-hover:translate-x-[-2px] transition-transform">
                  ←
                </span>
                <span>Previous: {previousContent.title}</span>
              </Link>
            ) : (
              <div></div>
            )}

            {nextContent ? (
              <Link
                href={`/${nextContent.slug}`}
                className="text-primary hover:text-primary/80 hover:underline text-sm flex items-center gap-1 group"
              >
                <span>Next: {nextContent.title}</span>
                <span className="group-hover:translate-x-[2px] transition-transform">
                  →
                </span>
              </Link>
            ) : (
              <div></div>
            )}
          </div>
        </div>
      </div>

      {/* Table of Contents - Fixed on large screens */}
      <div className="hidden xl:block xl:fixed xl:top-20 xl:right-8 xl:w-64 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
        <TableOfContents content={content.content} />
      </div>
    </div>
  );
}
