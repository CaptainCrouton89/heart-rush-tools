'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
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

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      const container = containerRef.current;
      if (container) {
        setScrollPos({ x: container.scrollLeft, y: container.scrollTop });
      }
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && containerRef.current) {
      const deltaX = dragStart.x - e.clientX;
      const deltaY = dragStart.y - e.clientY;
      
      containerRef.current.scrollLeft = scrollPos.x + deltaX;
      containerRef.current.scrollTop = scrollPos.y + deltaY;
    }
  }, [isDragging, dragStart, scrollPos]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.05), 2));
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      } else if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen(!isFullscreen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

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

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between p-4 bg-card border-b border-border flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit Fullscreen
            </button>
            <h1 className="text-2xl font-bold text-foreground">Map of {displayName}</h1>
            <div className="flex items-center gap-2">
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
        
        {/* Fullscreen Map Container */}
        <div 
          ref={containerRef}
          className={`flex-1 overflow-auto bg-card ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
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
              <div className="text-destructive text-center">
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
              key={`${mapName}-${currentQuality}`}
              src={mapImagePath}
              alt={`${currentQuality.toUpperCase()} resolution map of ${displayName}`}
              width={imageDimensions.width}
              height={imageDimensions.height}
              priority={currentQuality === 'low'}
              quality={currentQuality === 'high' ? 100 : 85}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`transition-opacity duration-300 ${imageLoaded && !isLoadingNewQuality ? 'opacity-100' : 'opacity-70'} pointer-events-none select-none`}
              style={{
                maxWidth: 'none',
                width: '100%',
                height: '100%',
                imageRendering: currentQuality === 'low' ? 'auto' : 'crisp-edges'
              }}
              draggable={false}
            />
            
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
        </div>
        
        {/* Fullscreen Help */}
        <div className="absolute top-20 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-sm text-muted-foreground max-w-xs">
          <p className="font-medium mb-1">Controls:</p>
          <p>• Click and drag to pan</p>
          <p>• Mouse wheel to zoom in/out</p>
          <p>• Press F or Escape to exit fullscreen</p>
          <p className="mt-2 text-xs">Map: 20,480 × 20,480 pixels</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link
                href="/maps"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Maps
              </Link>
            </div>
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
              onClick={toggleFullscreen}
              className="px-3 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors"
            >
              Fullscreen
            </button>
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
          className={`relative w-full h-[80vh] overflow-auto border rounded-lg bg-card ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
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
              key={`${mapName}-${currentQuality}`}
              src={mapImagePath}
              alt={`${currentQuality.toUpperCase()} resolution map of ${displayName}`}
              width={imageDimensions.width}
              height={imageDimensions.height}
              priority={currentQuality === 'low'}
              quality={currentQuality === 'high' ? 100 : 85}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`transition-opacity duration-300 ${imageLoaded && !isLoadingNewQuality ? 'opacity-100' : 'opacity-70'} pointer-events-none select-none`}
              style={{
                maxWidth: 'none',
                width: '100%',
                height: '100%',
                imageRendering: currentQuality === 'low' ? 'auto' : 'crisp-edges'
              }}
              draggable={false}
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
            <p>• Click and drag to pan around the map</p>
            <p>• Mouse wheel to zoom in/out</p>
            <p>• Press F for fullscreen mode</p>
            <p className="mt-2 text-xs">Map: 20,480 × 20,480 pixels</p>
          </div>
        </div>
      </div>
    </div>
  );
}