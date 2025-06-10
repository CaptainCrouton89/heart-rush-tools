#!/usr/bin/env python3
"""
One-time script to extract talents from Talents.md into individual files.
Creates separate directories for combat and noncombat talents.
"""

import os
import re
from pathlib import Path

def extract_talents():
    # Read the talents file
    talents_file = Path("heart_rush/all_sections_formatted/Talents.md")
    
    if not talents_file.exists():
        print(f"Error: {talents_file} not found")
        return
    
    with open(talents_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Create output directories
    combat_dir = Path("heart_rush/talents/combat_talents")
    noncombat_dir = Path("heart_rush/talents/noncombat_talents")
    
    combat_dir.mkdir(parents=True, exist_ok=True)
    noncombat_dir.mkdir(parents=True, exist_ok=True)
    
    # Split content into combat and noncombat sections
    # Find the "## Combat Talents" and "## Noncombat Talents" sections
    combat_match = re.search(r'## Combat Talents\n(.*?)(?=## Noncombat Talents|$)', content, re.DOTALL)
    noncombat_match = re.search(r'## Noncombat Talents\n(.*?)$', content, re.DOTALL)
    
    if not combat_match:
        print("Error: Could not find Combat Talents section")
        return
    
    if not noncombat_match:
        print("Error: Could not find Noncombat Talents section")
        return
    
    combat_content = combat_match.group(1).strip()
    noncombat_content = noncombat_match.group(1).strip()
    
    # Extract individual talents from each section
    extract_talents_from_section(combat_content, combat_dir, "combat")
    extract_talents_from_section(noncombat_content, noncombat_dir, "noncombat")

def extract_talents_from_section(section_content, output_dir, section_type):
    """Extract individual talents from a section and save as separate files."""
    
    # Pattern to match talent headers (### Talent Name)
    talent_pattern = r'### ([^\n]+)\n((?:(?!### ).)*?)(?=### |$)'
    
    talents = re.findall(talent_pattern, section_content, re.DOTALL)
    
    print(f"Found {len(talents)} {section_type} talents")
    
    for talent_name, talent_content in talents:
        # Clean up talent name for filename
        filename = talent_name.strip()
        # Replace spaces with underscores and remove special characters
        filename = re.sub(r'[^\w\s-]', '', filename)
        filename = re.sub(r'[-\s]+', '_', filename)
        filename = filename.strip('_')
        
        # Create the full talent content with proper header
        full_content = f"## {talent_name}\n\n{talent_content.strip()}\n"
        
        # Write to file
        file_path = output_dir / f"{filename}.md"
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(full_content)
        
        print(f"Created: {file_path}")

if __name__ == "__main__":
    extract_talents()