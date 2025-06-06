'use client';

import { useState } from 'react';

export function SearchInput() {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // TODO: Implement search functionality in task 8
      console.log('Search query:', query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search documentation..."
        className="
          w-full pl-10 pr-4 py-2 text-sm
          bg-gray-50 dark:bg-gray-800
          border border-gray-300 dark:border-gray-600
          rounded-md
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          text-gray-900 dark:text-gray-100
          placeholder-gray-500 dark:placeholder-gray-400
        "
      />
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
      </div>
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
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
  );
}