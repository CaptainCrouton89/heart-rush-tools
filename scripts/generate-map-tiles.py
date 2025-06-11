#!/usr/bin/env python3
"""
Generate optimized map tiles and thumbnails for large images.

This script creates multiple resolution versions of large map images:
- Thumbnail (512x512) for previews
- Low resolution (2000x2000) for initial zoom-out view
- Medium resolution (8000x8000) for medium zoom
- Full resolution (20000x20000) for maximum zoom

Usage:
    python scripts/generate-map-tiles.py <input_image> <map_name>
"""

import os
import sys
from PIL import Image, ImageOps
import argparse

# Increase PIL's image size limit for large maps
Image.MAX_IMAGE_PIXELS = None

def ensure_dir(directory):
    """Create directory if it doesn't exist."""
    os.makedirs(directory, exist_ok=True)

def generate_map_versions(input_path, map_name, output_dir):
    """Generate multiple resolution versions of a map image."""
    
    print(f"Processing {input_path}...")
    
    # Open the original image
    try:
        with Image.open(input_path) as img:
            # Ensure image is in RGB mode
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            original_size = img.size
            print(f"Original size: {original_size}")
            
            # Define output sizes and quality settings
            versions = [
                {"suffix": "thumb", "size": (512, 512), "quality": 85},
                {"suffix": "low", "size": (2000, 2000), "quality": 80},
                {"suffix": "medium", "size": (8000, 8000), "quality": 85},
                {"suffix": "high", "size": original_size, "quality": 90}
            ]
            
            for version in versions:
                output_path = os.path.join(output_dir, f"{map_name}_{version['suffix']}.jpg")
                
                if version['suffix'] == 'high':
                    # For high resolution, just optimize the original
                    print(f"Optimizing original as high resolution...")
                    img.save(output_path, 'JPEG', quality=version['quality'], optimize=True)
                else:
                    # Resize for other versions
                    print(f"Creating {version['suffix']} version ({version['size']})...")
                    resized = img.resize(version['size'], Image.Resampling.LANCZOS)
                    resized.save(output_path, 'JPEG', quality=version['quality'], optimize=True)
                
                # Check file size
                size_mb = os.path.getsize(output_path) / (1024 * 1024)
                print(f"  Saved: {output_path} ({size_mb:.1f}MB)")
            
            print(f"✅ Generated all versions for {map_name}")
            
    except Exception as e:
        print(f"❌ Error processing {input_path}: {e}")
        return False
    
    return True

def main():
    parser = argparse.ArgumentParser(description='Generate optimized map tiles')
    parser.add_argument('input_image', help='Path to input image')
    parser.add_argument('map_name', help='Name of the map (e.g., alaria)')
    parser.add_argument('--output-dir', default='public/heart_rush/maps/images', 
                       help='Output directory (default: public/heart_rush/maps/images)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_image):
        print(f"❌ Input image not found: {args.input_image}")
        sys.exit(1)
    
    ensure_dir(args.output_dir)
    
    success = generate_map_versions(args.input_image, args.map_name, args.output_dir)
    
    if success:
        print("\n🎉 Map optimization complete!")
        print("\nGenerated files:")
        print(f"  - {args.map_name}_thumb.jpg (512x512) - for previews")
        print(f"  - {args.map_name}_low.jpg (2000x2000) - for initial view")
        print(f"  - {args.map_name}_medium.jpg (8000x8000) - for medium zoom")
        print(f"  - {args.map_name}_high.jpg (original size) - for full zoom")
    else:
        print("❌ Map optimization failed")
        sys.exit(1)

if __name__ == '__main__':
    main()