'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';

// Define quality levels based on zoom
const getImageQuality = (zoom: number): 'low' | 'medium' | 'high' => {
  if (zoom <= 0.15) return 'low';
  if (zoom <= 0.5) return 'medium';
  return 'high';
};

const getImageDimensions = (quality: 'low' | 'medium' | 'high') => {
  switch (quality) {
    case 'low': return { width: 2000, height: 2000 };
    case 'medium': return { width: 8000, height: 8000 };
    case 'high': return { width: 20480, height: 20480 };
  }
};

export default function MapPage() {
  const params = useParams();
  const mapName = params.name as string;
  const [zoom, setZoom] = useState(0.1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<'low' | 'medium' | 'high'>('low');
  const [isLoadingNewQuality, setIsLoadingNewQuality] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.5, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.5, 0.05));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(0.1);
  }, []);

  // Effect to handle quality switching based on zoom level
  useEffect(() => {
    const requiredQuality = getImageQuality(zoom);
    
    if (requiredQuality !== currentQuality) {
      setIsLoadingNewQuality(true);
      setCurrentQuality(requiredQuality);
    }
  }, [zoom, currentQuality]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setIsLoadingNewQuality(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setIsLoadingNewQuality(false);
  }, []);

  const mapImagePath = `/heart_rush/maps/images/${mapName}_${currentQuality}.jpg`;
  const displayName = mapName.charAt(0).toUpperCase() + mapName.slice(1);
  const imageDimensions = getImageDimensions(currentQuality);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Map of {displayName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                Quality: {currentQuality.toUpperCase()}
              </span>
              {isLoadingNewQuality && (
                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-1">
                  <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              disabled={zoom <= 0.05}
            >
              Zoom Out
            </button>
            <span className="px-3 py-2 bg-muted rounded-md text-muted-foreground min-w-[80px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              disabled={zoom >= 2}
            >
              Zoom In
            </button>
            <button
              onClick={handleResetZoom}
              className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
        
        <div 
          ref={containerRef}
          className="relative w-full h-[80vh] overflow-auto border rounded-lg bg-card cursor-grab active:cursor-grabbing"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent'
          }}
        >
          {!imageLoaded && !imageError && (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading high-resolution map...</div>
            </div>
          )}
          
          {imageError && (
            <div className="flex items-center justify-center h-full">
              <div className="text-destructive">
                Map not found: {mapImagePath}
                <br />
                <span className="text-sm text-muted-foreground">
                  Please ensure the map image exists in the public directory
                </span>
              </div>
            </div>
          )}
          
          <div 
            className="relative transition-all duration-200 ease-out"
            style={{ 
              width: `${imageDimensions.width * zoom}px`, 
              height: `${imageDimensions.height * zoom}px`,
              minWidth: `${imageDimensions.width * zoom}px`,
              minHeight: `${imageDimensions.height * zoom}px`
            }}
          >
            <Image
              key={`${mapName}-${currentQuality}`} // Force re-render on quality change
              src={mapImagePath}
              alt={`${currentQuality.toUpperCase()} resolution map of ${displayName}`}
              width={imageDimensions.width}
              height={imageDimensions.height}
              priority={currentQuality === 'low'}
              quality={currentQuality === 'high' ? 100 : 85}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`transition-opacity duration-300 ${
                imageLoaded && !isLoadingNewQuality ? 'opacity-100' : 'opacity-70'
              }`}
              style={{
                maxWidth: 'none',
                width: '100%',
                height: '100%',
                imageRendering: currentQuality === 'low' ? 'auto' : 'crisp-edges'
              }}
            />
            
            {/* Loading overlay for quality transitions */}
            {isLoadingNewQuality && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                <div className="bg-background/90 backdrop-blur-sm rounded-lg p-4 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-foreground">
                    Loading {currentQuality.toUpperCase()} quality...
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-sm text-muted-foreground max-w-xs">
            <p className="font-medium mb-1">Navigation:</p>
            <p>• Scroll to pan around the map</p>
            <p>• Use zoom controls to resize</p>
            <p>• Drag to pan when zoomed in</p>
            <p className="mt-2 text-xs">Map: 20,480 × 20,480 pixels</p>
          </div>
        </div>
      </div>
    </div>
  );
}