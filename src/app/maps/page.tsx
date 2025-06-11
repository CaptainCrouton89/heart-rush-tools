'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface MapInfo {
  name: string;
  displayName: string;
  imagePath: string;
  exists: boolean;
}

export default function MapsPage() {
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For now, we'll define available maps manually
    // In the future, this could be dynamic by scanning the maps directory
    const availableMaps: MapInfo[] = [
      {
        name: 'alaria',
        displayName: 'Alaria',
        imagePath: '/heart_rush/maps/images/alaria_thumb.jpg',
        exists: true
      }
      // Add more maps here as they become available
    ];

    setMaps(availableMaps);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <h1 className="text-4xl font-bold mb-8 text-foreground">Maps</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border border-border overflow-hidden animate-pulse">
                <div className="w-full h-48 bg-muted"></div>
                <div className="p-4">
                  <div className="h-6 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 text-foreground">Maps</h1>
          <p className="text-muted-foreground text-lg">
            Explore the world of Heart Rush with high-resolution interactive maps
          </p>
        </div>

        {maps.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-2xl font-semibold mb-2 text-foreground">No maps available</h2>
            <p className="text-muted-foreground">
              Maps will appear here once they are added to the system
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {maps.map((map) => (
              <Link
                key={map.name}
                href={`/maps/${map.name}`}
                className="group bg-card rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
              >
                <div className="relative w-full h-48 bg-muted overflow-hidden">
                  {map.exists ? (
                    <Image
                      src={map.imagePath}
                      alt={`Preview of ${map.displayName} map`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🗺️</div>
                        <div className="text-sm">Map Preview</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Overlay with map info */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="absolute bottom-2 left-2 text-white">
                      <div className="text-xs opacity-80">Click to explore</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="text-xl font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
                    {map.displayName}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    High-resolution interactive map with zoom and pan controls
                  </p>
                  <div className="mt-3 flex items-center text-xs text-muted-foreground">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    20,000 × 20,000 pixels
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-muted rounded-lg text-muted-foreground text-sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            More maps will be added as they become available
          </div>
        </div>
      </div>
    </div>
  );
}