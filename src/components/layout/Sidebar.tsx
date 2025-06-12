"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useGM } from "../../context/GMContext";
import { CategorizedNavigationNode, SearchResult } from "../../types/content";
import { SearchInput } from "../search/SearchInput";
import { SearchResults } from "../search/SearchResults";
import { NavigationTree } from "./NavigationTree";
import { ThemeToggle } from "./ThemeToggle";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { isGMMode, setGMMode } = useGM();
  const [navigation, setNavigation] = useState<CategorizedNavigationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    const loadNavigation = async () => {
      try {
        // Fetch navigation from API route (GM or regular)
        const endpoint = isGMMode ? "/api/gm/navigation" : "/api/navigation";
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error("Failed to fetch navigation");
        const nav = await response.json();
        setNavigation(nav);
      } catch (error) {
        console.error("Failed to load navigation:", error);
        setNavigation([]); // Fallback to empty array
      } finally {
        setLoading(false);
      }
    };

    loadNavigation();
  }, [isGMMode]);

  const handleSearchResults = (results: SearchResult[]) => {
    setSearchResults(results);
    setShowSearchResults(results.length > 0 || searchQuery.trim().length > 0);
  };

  const handleQueryChange = (query: string) => {
    setSearchQuery(query);
    setShowSearchResults(query.trim().length > 0);
  };

  const handleCloseSearch = () => {
    setShowSearchResults(false);
    setSearchResults([]);
    setSearchQuery("");
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-80
          bg-card border-r border-border
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          flex flex-col h-screen overflow-hidden transition-colors
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/5">
          <Link
            href="/"
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                HR
              </span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Heart Rush
            </h1>
          </Link>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <button
              onClick={onToggle}
              className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              aria-label="Close sidebar"
            >
              <svg
                className="w-5 h-5"
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
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border relative">
          <SearchInput
            onResults={handleSearchResults}
            onQueryChange={handleQueryChange}
            onClose={handleCloseSearch}
            searchResults={searchResults}
            value={searchQuery}
          />
          <SearchResults
            results={searchResults}
            query={searchQuery}
            isVisible={showSearchResults}
            onClose={handleCloseSearch}
            onClearInput={handleCloseSearch}
          />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-2">
              {/* Loading skeleton */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <NavigationTree nodes={navigation} onNavigate={onToggle} />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-gradient-to-r from-accent/5 to-primary/5">
          {/* Quick Navigation */}
          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground mb-2 text-center">Quick Access</div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/maps"
                className="flex items-center justify-center gap-2 px-3 py-2 text-xs bg-background/50 hover:bg-background border border-border/50 hover:border-primary/50 rounded-md transition-all duration-200 hover:shadow-sm"
                onClick={onToggle}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                </svg>
                Maps
              </Link>
              <Link
                href="/tools"
                className="flex items-center justify-center gap-2 px-3 py-2 text-xs bg-background/50 hover:bg-background border border-border/50 hover:border-primary/50 rounded-md transition-all duration-200 hover:shadow-sm"
                onClick={onToggle}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                Tools
              </Link>
            </div>
          </div>

          {/* GM Mode Toggle */}
          <div className="flex items-center justify-center mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted-foreground">Player</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isGMMode}
                  onChange={(e) => setGMMode(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-10 h-5 rounded-full transition-colors ${
                    isGMMode ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      isGMMode ? "translate-x-5" : "translate-x-0.5"
                    } translate-y-0.5`}
                  />
                </div>
              </div>
              <span className="text-xs text-muted-foreground">GM</span>
            </label>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Heart Rush TTRPG Reference
          </p>
          <div className="flex justify-center mt-2">
            <div className="w-16 h-1 bg-gradient-to-r from-primary via-accent to-secondary rounded-full"></div>
          </div>
        </div>
      </aside>
    </>
  );
}
