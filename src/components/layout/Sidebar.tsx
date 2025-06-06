'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { NavigationTree } from './NavigationTree';
import { SearchInput } from '../search/SearchInput';
import { SearchResults } from '../search/SearchResults';
import { ThemeToggle } from './ThemeToggle';
import { NavigationNode, SearchResult } from '../../types/content';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [navigation, setNavigation] = useState<NavigationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    const loadNavigation = async () => {
      try {
        // Fetch navigation from API route instead of direct import
        const response = await fetch('/api/navigation');
        if (!response.ok) throw new Error('Failed to fetch navigation');
        const nav = await response.json();
        setNavigation(nav);
      } catch (error) {
        console.error('Failed to load navigation:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNavigation();
  }, []);

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
    setSearchQuery('');
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
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col h-screen overflow-hidden
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/5">
          <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">HR</span>
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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