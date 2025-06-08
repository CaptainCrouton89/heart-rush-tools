#!/usr/bin/env python3
"""
Script to split the Races.md file into individual race files.
Each level 2 header (##) becomes a separate file.
"""

import os
import re
from pathlib import Path

def split_races_file():
    # Define paths
    source_file = Path("/Users/silasrhyneer/Code/heart-rush-tools/heart_rush/all_sections_formatted/Races.md")
    output_dir = Path("/Users/silasrhyneer/Code/heart-rush-tools/races")
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(exist_ok=True)
    
    # Read the source file
    with open(source_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split content by level 2 headers
    sections = re.split(r'^## (.+)$', content, flags=re.MULTILINE)
    
    # The first section is everything before the first ## header (title and intro)
    intro_section = sections[0].strip()
    
    # Process each race section
    race_count = 0
    for i in range(1, len(sections), 2):
        if i + 1 < len(sections):
            race_name = sections[i].strip()
            race_content = sections[i + 1].strip()
            
            # Create filename from race name (sanitize for filesystem)
            filename = re.sub(r'[^\w\s-]', '', race_name)
            filename = re.sub(r'[-\s]+', '_', filename)
            filename = f"{filename}.md"
            
            # Combine header and content
            full_content = f"## {race_name}\n\n{race_content}"
            
            # Write to file
            output_path = output_dir / filename
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(full_content)
            
            print(f"Created: {filename}")
            race_count += 1
    
    print(f"\nSuccessfully split {race_count} races into individual files.")
    print(f"Output directory: {output_dir}")

if __name__ == "__main__":
    split_races_file()