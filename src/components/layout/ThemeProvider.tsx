'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ReactNode, useEffect, useState } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Only render ThemeProvider after client-side mount to avoid SSR localStorage issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Return children without theme provider during SSR
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="theme"
    >
      {children}
    </NextThemesProvider>
  );
}
