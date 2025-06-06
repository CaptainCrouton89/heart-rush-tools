"use client";

import { ContentSection } from "../../types/content";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface ChildrenContentProps {
  children: ContentSection[];
}

export function ChildrenContent({ children }: ChildrenContentProps) {
  if (!children || children.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 space-y-6">
      {children.map((child) => (
        <section key={child.slug}>
          <h2 className="text-2xl font-semibold text-primary mb-4">
            {child.title}
          </h2>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <MarkdownRenderer content={child.content} />
          </div>
        </section>
      ))}
    </div>
  );
}