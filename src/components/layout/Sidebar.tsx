'use client';

import { useState, useEffect } from 'react';
import { NavigationTree } from './NavigationTree';
import { SearchInput } from '../search/SearchInput';
import { ThemeToggle } from './ThemeToggle';
import { NavigationNode } from '../../types/content';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [navigation, setNavigation] = useState<NavigationNode[]>([]);
  const [loading, setLoading] = useState(true);

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
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col h-screen overflow-hidden
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Heart Rush
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <button
              onClick={onToggle}
              className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <SearchInput />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-2">
              {/* Loading skeleton */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <NavigationTree nodes={navigation} onNavigate={onToggle} />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Heart Rush TTRPG Reference
          </p>
        </div>
      </aside>
    </>
  );
}