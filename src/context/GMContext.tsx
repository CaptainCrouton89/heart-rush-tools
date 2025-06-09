'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface GMContextType {
  isGMMode: boolean;
  setGMMode: (gmMode: boolean) => void;
}

const GMContext = createContext<GMContextType | undefined>(undefined);

export function GMProvider({ children }: { children: ReactNode }) {
  const [isGMMode, setIsGMMode] = useState(false);

  // Load GM mode from localStorage on mount
  useEffect(() => {
    const savedGMMode = localStorage.getItem('gmMode');
    if (savedGMMode !== null) {
      setIsGMMode(JSON.parse(savedGMMode));
    }
  }, []);

  const setGMMode = (gmMode: boolean) => {
    setIsGMMode(gmMode);
    localStorage.setItem('gmMode', JSON.stringify(gmMode));
  };

  return (
    <GMContext.Provider value={{ isGMMode, setGMMode }}>
      {children}
    </GMContext.Provider>
  );
}

export function useGM() {
  const context = useContext(GMContext);
  if (context === undefined) {
    throw new Error('useGM must be used within a GMProvider');
  }
  return context;
}