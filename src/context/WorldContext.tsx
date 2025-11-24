'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface WorldContextType {
  currentWorld: string | null;
  setCurrentWorld: (world: string | null) => void;
  availableWorlds: string[];
}

const WorldContext = createContext<WorldContextType | undefined>(undefined);

export function WorldProvider({ children }: { children: ReactNode }) {
  const [currentWorld, setCurrentWorldState] = useState<string | null>(null);
  const [availableWorlds, setAvailableWorlds] = useState<string[]>([]);

  // Load world context from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return;

    const savedWorld = localStorage.getItem('heart-rush-world-context');
    if (savedWorld !== null) {
      setCurrentWorldState(savedWorld === 'null' ? null : savedWorld);
    }

    // Fetch available worlds
    fetch('/api/worlds')
      .then(res => res.json())
      .then(data => setAvailableWorlds(data.worlds || []))
      .catch(err => console.error('Failed to load available worlds:', err));
  }, []);

  const setCurrentWorld = (world: string | null) => {
    setCurrentWorldState(world);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem('heart-rush-world-context', world === null ? 'null' : world);
    }
  };

  return (
    <WorldContext.Provider value={{ currentWorld, setCurrentWorld, availableWorlds }}>
      {children}
    </WorldContext.Provider>
  );
}

export function useWorld() {
  const context = useContext(WorldContext);
  if (context === undefined) {
    throw new Error('useWorld must be used within a WorldProvider');
  }
  return context;
}
