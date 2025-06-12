# Maps System

## Overview
Interactive map viewing system that provides high-resolution world maps for the Heart Rush TTRPG setting. Features responsive image display, multiple resolution options, and organized map browsing for campaign reference and world exploration.

## How It Works
1. **Map Collection**: Curated collection of world maps in multiple resolutions
2. **Image Optimization**: Multiple resolution versions (thumb, medium, high) for performance
3. **Responsive Display**: Adaptive layouts for different screen sizes and zoom levels
4. **Navigation Interface**: Organized browsing with thumbnails and quick access
5. **Interactive Viewing**: Zoom, pan, and detailed examination capabilities

## Key Files
- **`src/app/maps/page.tsx`** - Maps overview and gallery page
- **`src/app/maps/[name]/page.tsx`** - Individual map viewer page
- **`public/heart_rush/maps/images/`** - Map image storage directory
- **Map Generation Scripts**: Python scripts for creating map tiles and optimizations

## Map Structure
### Image Hierarchy
```
public/heart_rush/maps/images/
├── alaria_thumb.jpg     # Thumbnail (150x150)
├── alaria_medium.jpg    # Medium res (800x600)
└── alaria_low.jpg       # High res (1920x1440)
```

### Map Metadata
```typescript
interface MapData {
  name: string;
  title: string;
  description: string;
  resolutions: {
    thumb: string;
    medium: string;
    high: string;
  };
  dimensions: {
    width: number;
    height: number;
  };
  tags: string[];
}
```

## Map Gallery
### Overview Page (`/maps`)
- **Grid Layout**: Thumbnail grid of available maps
- **Quick Preview**: Hover effects and basic map information
- **Filter Options**: Filter maps by type, region, or campaign
- **Search Integration**: Find specific maps or regions
- **Responsive Grid**: Adapts to screen size with appropriate columns

### Individual Map Pages (`/maps/[name]`)
- **High-Resolution Display**: Full-size map viewing
- **Zoom Controls**: Pan and zoom for detailed examination
- **Image Optimization**: Progressive loading of different resolutions
- **Download Options**: Export maps in various formats
- **Navigation**: Previous/next map browsing

## Image Optimization
### Multi-Resolution Strategy
```typescript
const resolutions = {
  thumb: { width: 150, height: 150, quality: 70 },
  medium: { width: 800, height: 600, quality: 85 },
  high: { width: 1920, height: 1440, quality: 95 }
};
```

### Performance Features
- **Lazy Loading**: Images load only when needed
- **Progressive Enhancement**: Start with low-res, upgrade to high-res
- **WebP Support**: Modern image formats for better compression
- **Caching**: Aggressive caching for repeated map access
- **Preloading**: Preload adjacent maps for smooth navigation

## Interactive Features
### Zoom and Pan
```typescript
interface ViewportState {
  scale: number;
  translateX: number;
  translateY: number;
  maxScale: number;
  minScale: number;
}
```

### Touch Support
- **Pinch to Zoom**: Native touch gestures on mobile
- **Pan Gestures**: Drag to move around large maps
- **Double Tap**: Quick zoom to fit/fill screen
- **Rotation Lock**: Prevent accidental orientation changes

### Keyboard Navigation
- **Arrow Keys**: Pan around the map
- **Plus/Minus**: Zoom in and out
- **Home**: Reset to default view
- **Escape**: Exit fullscreen mode

## Map Types
### World Maps
- **Continental**: Large-scale geographic overviews
- **Regional**: Detailed area maps for campaigns
- **Political**: Kingdom and territory boundaries
- **Topographical**: Terrain and elevation information

### Tactical Maps
- **Dungeon Maps**: Indoor location layouts
- **Battle Maps**: Combat encounter locations
- **City Maps**: Urban area navigation
- **Building Plans**: Detailed structure layouts

### Specialized Maps
- **Travel Maps**: Routes and journey planning
- **Resource Maps**: Natural resource locations
- **Climate Maps**: Weather and environmental zones
- **Cultural Maps**: Demographic and cultural regions

## Map Generation Pipeline
### Source Processing
```python
# scripts/generate-map-tiles.py
def process_map_image(source_path, output_dir):
    """Generate multiple resolution versions of map images"""
    resolutions = [
        ("thumb", 150, 150),
        ("medium", 800, 600), 
        ("high", 1920, 1440)
    ]
    
    for suffix, width, height in resolutions:
        generate_resolution(source_path, output_dir, suffix, width, height)
```

### Automated Processing
- **Batch Processing**: Handle multiple maps simultaneously
- **Quality Optimization**: Balance file size and visual quality
- **Format Conversion**: Convert to web-optimized formats
- **Metadata Extraction**: Extract dimensions and other properties

## Responsive Design
### Desktop Layout
- **Large Viewport**: Full-screen map viewing with controls
- **Sidebar Navigation**: Map list and information panel
- **Zoom Controls**: Precise zoom controls and viewport indicators
- **Keyboard Shortcuts**: Full keyboard navigation support

### Tablet Layout
- **Touch-Optimized**: Larger touch targets and gestures
- **Overlay Controls**: Floating controls that don't obstruct view
- **Orientation Support**: Both portrait and landscape viewing
- **Split View**: Option to view map list alongside current map

### Mobile Layout
- **Full-Screen Focus**: Maximize map viewing area
- **Gesture Navigation**: Swipe between maps and zoom/pan
- **Bottom Navigation**: Map controls at bottom for thumb access
- **Quick Actions**: Simplified control set for mobile use

## Integration Points
### Campaign Integration
- **Session Planning**: GMs can reference maps during prep
- **Live Reference**: Quick map access during gameplay
- **Player Sharing**: Share specific maps with players
- **Annotation Support**: Future feature for marking locations

### Content Linking
- **Location References**: Content sections link to relevant maps
- **Cross-References**: Maps reference related content sections
- **Search Integration**: Maps appear in global search results
- **Tag System**: Maps tagged with relevant content categories

## Performance Considerations
### Loading Optimization
- **Progressive Loading**: Start with low-res placeholders
- **Bandwidth Adaptation**: Serve appropriate resolution for connection
- **Caching Strategy**: Aggressive caching of frequently accessed maps
- **Preloading**: Smart preloading of likely-needed maps

### Memory Management
- **Image Cleanup**: Unload off-screen high-resolution images
- **Viewport Culling**: Only process visible map portions
- **Resolution Scaling**: Dynamically adjust resolution based on zoom
- **Background Processing**: Load high-res versions in background

## Accessibility Features
### Screen Reader Support
- **Alt Text**: Descriptive text for all map images
- **Navigation Aids**: Clear heading structure and landmarks
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Logical focus order through interface

### Visual Accessibility
- **High Contrast**: Optional high-contrast viewing modes
- **Zoom Support**: Support for browser zoom and system accessibility
- **Color Blind Support**: Maps designed for color accessibility
- **Text Scaling**: UI scales with system text size preferences

## Future Enhancements
### Interactive Features
- **Layer Support**: Toggle different map layers (political, terrain, etc.)
- **Annotation Tools**: Add notes and markers to maps
- **Measurement Tools**: Distance and area measurement
- **Custom Maps**: User-uploaded campaign maps

### Advanced Viewing
- **3D Visualization**: Height maps and 3D terrain viewing
- **Animation Support**: Animated maps showing changes over time
- **VR Integration**: Virtual reality map exploration
- **AR Overlay**: Augmented reality features for table gaming

### Collaboration Features
- **Shared Viewing**: Multiple users viewing same map
- **Real-time Annotations**: Collaborative map marking
- **Campaign Journals**: Link maps to campaign notes
- **Export Integration**: Export to virtual tabletop platforms

## Development Notes
- Maps stored as static assets in public directory
- Image optimization handled by build-time scripts
- Responsive images use Next.js Image component for optimization
- Map metadata can be extended for additional features
- System designed to be extensible for user-generated content