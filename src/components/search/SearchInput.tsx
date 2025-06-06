'use client';

import { useState, useEffect, useRef } from 'react';
import { searchContent, getSearchSuggestions } from '../../lib/search';
import { SearchResult } from '../../types/content';

interface SearchInputProps {
  onResults?: (results: SearchResult[]) => void;
  onQueryChange?: (query: string) => void;
}

export function SearchInput({ onResults, onQueryChange }: SearchInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      onResults?.([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchContent(searchQuery, undefined, 20);
      onResults?.(results);
    } catch (error) {
      console.error('Search failed:', error);
      onResults?.([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getSuggestions = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const suggestionList = await getSearchSuggestions(searchQuery, 5);
      setSuggestions(suggestionList);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      setSuggestions([]);
    }
  };

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onQueryChange?.(query);
      
      if (query.trim()) {
        performSearch(query);
        getSuggestions(query);
      } else {
        onResults?.([]);
        setSuggestions([]);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onResults, onQueryChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (query.trim()) {
      performSearch(query);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 150);
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Search documentation..."
          className="
            w-full pl-10 pr-10 py-2 text-sm
            bg-gray-50 dark:bg-gray-800
            border border-gray-300 dark:border-gray-600
            rounded-md
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            text-gray-900 dark:text-gray-100
            placeholder-gray-500 dark:placeholder-gray-400
          "
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-500"></div>
          ) : (
            <svg 
              className="w-4 h-4 text-gray-400 dark:text-gray-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
              />
            </svg>
          )}
        </div>
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onResults?.([]);
              setSuggestions([]);
              setShowSuggestions(false);
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <svg 
              className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" 
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
      </form>

      {/* Search Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="
                w-full px-3 py-2 text-sm text-left
                hover:bg-gray-100 dark:hover:bg-gray-700
                text-gray-900 dark:text-gray-100
                border-b last:border-b-0 border-gray-200 dark:border-gray-600
              "
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}