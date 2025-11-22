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
  const [cachedImages, setCachedImages] = useState<Record<string, boolean>>({});
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const [showInfoBox, setShowInfoBox] = useState(true);
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
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.min(Math.max(prev * delta, 0.05), 2));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Load info box visibility from localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return;

    const saved = localStorage.getItem('maps-info-box-hidden');
    if (saved === 'true') {
      setShowInfoBox(false);
    }
  }, []);

  // Handle closing info box
  const closeInfoBox = useCallback(() => {
    setShowInfoBox(false);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem('maps-info-box-hidden', 'true');
    }
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      } else if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen(!isFullscreen);
      } else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        setShowInfoBox(!showInfoBox);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, showInfoBox]);

  // Preload images for faster switching
  useEffect(() => {
    const qualities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    
    qualities.forEach((quality) => {
      const imagePath = `/heart_rush/maps/images/${mapName}_${quality}.jpg`;
      
      if (!cachedImages[quality] && !imageLoadingStates[quality]) {
        setImageLoadingStates(prev => ({ ...prev, [quality]: true }));
        
        // Use Next.js image preloading for better integration
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = imagePath;
        
        link.onload = () => {
          setCachedImages(prev => ({ ...prev, [quality]: true }));
          setImageLoadingStates(prev => ({ ...prev, [quality]: false }));
        };
        
        link.onerror = () => {
          console.warn(`Failed to preload ${quality} quality image:`, imagePath);
          setImageLoadingStates(prev => ({ ...prev, [quality]: false }));
        };
        
        document.head.appendChild(link);
        
        // Cleanup function to remove the link after some time
        setTimeout(() => {
          if (document.head.contains(link)) {
            document.head.removeChild(link);
          }
        }, 5000);
      }
    });
  }, [mapName, cachedImages, imageLoadingStates]);

  // Effect to handle quality switching based on zoom level
  useEffect(() => {
    const requiredQuality = getImageQuality(zoom);
    
    if (requiredQuality !== currentQuality) {
      // Start transition
      setIsLoadingNewQuality(true);
      setImageLoaded(false);
      
      // Small delay to ensure smooth transition
      setTimeout(() => {
        setCurrentQuality(requiredQuality);
      }, 50);
    }
  }, [zoom, currentQuality]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setIsLoadingNewQuality(false);
    // Mark this quality as cached
    setCachedImages(prev => ({ ...prev, [currentQuality]: true }));
  }, [currentQuality]);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setIsLoadingNewQuality(false);
  }, []);

  // Handle immediate quality switching for cached images
  useEffect(() => {
    if (cachedImages[currentQuality] && isLoadingNewQuality) {
      // Image is cached, immediately show it
      setImageLoaded(true);
      setIsLoadingNewQuality(false);
    }
  }, [currentQuality, cachedImages, isLoadingNewQuality]);

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
              <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                cachedImages[currentQuality] 
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {cachedImages[currentQuality] && (
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                )}
                Quality: {currentQuality.toUpperCase()}
              </span>
              {isLoadingNewQuality && (
                <span className="text-xs px-2 py-1 bg-secondary/20 text-secondary-foreground rounded-full flex items-center gap-1">
                  <div className="w-3 h-3 border border-secondary border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Loading: {Object.values(cachedImages).filter(Boolean).length}/3
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={zoom <= 0.05}
            >
              Zoom Out
            </button>
            <span className="px-3 py-2 bg-muted rounded-md text-muted-foreground min-w-[80px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={zoom >= 2}
            >
              Zoom In
            </button>
            <button
              onClick={handleResetZoom}
              className="px-3 py-2 bg-muted text-muted-foreground rounded-md hover:bg-secondary hover:text-secondary-foreground transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setShowInfoBox(!showInfoBox)}
              className={`px-3 py-2 rounded-md transition-colors ${
                showInfoBox 
                  ? 'bg-accent text-accent-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
              title="Toggle help (H)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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
              priority={true}
              quality={currentQuality === 'high' ? 100 : 85}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`transition-opacity duration-200 ease-out ${imageLoaded && !isLoadingNewQuality ? 'opacity-100' : 'opacity-0'} pointer-events-none select-none`}
              style={{
                maxWidth: 'none',
                width: '100%',
                height: '100%',
                imageRendering: currentQuality === 'low' ? 'auto' : 'crisp-edges',
                objectFit: 'contain'
              }}
              draggable={false}
              loading="eager"
              unoptimized={false}
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
        {showInfoBox && (
          <div className="absolute top-20 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-sm text-muted-foreground max-w-xs shadow-lg border border-border">
            <div className="flex items-start justify-between mb-2">
              <p className="font-medium">Controls:</p>
              <button
                onClick={closeInfoBox}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-sm hover:bg-accent"
                aria-label="Close help box"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p>• Click and drag to pan</p>
            <p>• Mouse wheel to zoom in/out</p>
            <p>• Press F or Escape to exit fullscreen</p>
            <p>• Press H or ? to toggle this help</p>
            <p className="mt-2 text-xs">Map: 20,480 × 20,480 pixels</p>
            <p className="mt-1 text-xs opacity-75">Images cached for instant switching</p>
          </div>
        )}
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
              <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                cachedImages[currentQuality] 
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {cachedImages[currentQuality] && (
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                )}
                Quality: {currentQuality.toUpperCase()}
              </span>
              {isLoadingNewQuality && (
                <span className="text-xs px-2 py-1 bg-secondary/20 text-secondary-foreground rounded-full flex items-center gap-1">
                  <div className="w-3 h-3 border border-secondary border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Loading: {Object.values(cachedImages).filter(Boolean).length}/3
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
            >
              Fullscreen
            </button>
            <button
              onClick={handleZoomOut}
              className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={zoom <= 0.05}
            >
              Zoom Out
            </button>
            <span className="px-3 py-2 bg-muted rounded-md text-muted-foreground min-w-[80px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={zoom >= 2}
            >
              Zoom In
            </button>
            <button
              onClick={handleResetZoom}
              className="px-3 py-2 bg-muted text-muted-foreground rounded-md hover:bg-secondary hover:text-secondary-foreground transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setShowInfoBox(!showInfoBox)}
              className={`px-3 py-2 rounded-md transition-colors ${
                showInfoBox 
                  ? 'bg-accent text-accent-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
              title="Toggle help (H)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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
              priority={true}
              quality={currentQuality === 'high' ? 100 : 85}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`transition-opacity duration-200 ease-out ${imageLoaded && !isLoadingNewQuality ? 'opacity-100' : 'opacity-0'} pointer-events-none select-none`}
              style={{
                maxWidth: 'none',
                width: '100%',
                height: '100%',
                imageRendering: currentQuality === 'low' ? 'auto' : 'crisp-edges',
                objectFit: 'contain'
              }}
              draggable={false}
              loading="eager"
              unoptimized={false}
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
          
          {showInfoBox && (
            <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-sm text-muted-foreground max-w-xs shadow-lg border border-border">
              <div className="flex items-start justify-between mb-2">
                <p className="font-medium">Navigation:</p>
                <button
                  onClick={closeInfoBox}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-sm hover:bg-accent"
                  aria-label="Close help box"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p>• Click and drag to pan around the map</p>
              <p>• Mouse wheel to zoom in/out</p>
              <p>• Press F for fullscreen mode</p>
              <p>• Press H or ? to toggle this help</p>
              <p className="mt-2 text-xs">Map: 20,480 × 20,480 pixels</p>
              <p className="mt-1 text-xs opacity-75">Images preloaded and cached</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}