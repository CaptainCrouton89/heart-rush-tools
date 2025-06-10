"use client";

import Link from "next/link";
import { SearchResult } from "../../types/content";

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  isVisible: boolean;
  onClose?: () => void;
  onClearInput?: () => void;
}

export function SearchResults({
  results,
  query,
  isVisible,
  onClose,
  onClearInput,
}: SearchResultsProps) {
  if (!isVisible || !query.trim()) {
    return null;
  }

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-primary text-primary-foreground rounded px-0.5"
        >
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  const formatReadingTime = (minutes: number): string => {
    if (minutes < 1) return "< 1 min";
    return `${Math.round(minutes)} min`;
  };

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
      <div className="sticky top-0 bg-muted px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""} for "
            {query}"
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <div className="text-muted-foreground">
            <svg
              className="mx-auto h-12 w-12 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33"
              />
            </svg>
            <h3 className="text-sm font-medium mb-2">No results found</h3>
            <p className="text-xs">
              Try adjusting your search terms or check for typos
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {results.map((result, index) => (
            <Link
              key={`${result.slug}-${index}`}
              href={`/${result.slug}`}
              onClick={() => {
                onClose?.();
                onClearInput?.();
              }}
              className="block px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    {highlightText(result.title, query)}
                  </h3>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                      {result.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Level {result.level}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatReadingTime(result.reading_time)} read
                    </span>
                  </div>

                  {result.snippet && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {highlightText(result.snippet, query)}
                    </p>
                  )}

                  {result.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground"
                        >
                          {highlightText(tag, query)}
                        </span>
                      ))}
                      {result.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{result.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 ml-2">
                  {result.score !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      {Math.round((1 - result.score) * 100)}% match
                    </div>
                  )}
                </div>
              </div>

              {result.matches && result.matches.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Matches in: {result.matches.map((m) => m.field).join(", ")}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="sticky bottom-0 bg-muted px-3 py-2 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Press Enter to search, Escape to close
          </p>
        </div>
      )}
    </div>
  );
}
