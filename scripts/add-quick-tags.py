#!/usr/bin/env python3
"""
Script to automatically add "Quick." tag to talent abilities that are not passive and not instant.
"""

import os
import re
from pathlib import Path

def process_talent_file(file_path):
    """Process a single talent file and add Quick. tag if needed."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        # Find the description line (usually line 3, starting with underscore)
        description_line = None
        description_line_index = None
        
        for i, line in enumerate(lines):
            if line.strip().startswith('_') and line.strip().endswith('_'):
                description_line = line.strip()
                description_line_index = i
                break
        
        if not description_line:
            print(f"Warning: No description line found in {file_path}")
            return False
        
        # Check if it's passive or instant
        description_lower = description_line.lower()
        if 'passive' in description_lower or 'instant' in description_lower:
            print(f"Skipping {file_path.name} - is passive or instant")
            return False
        
        # Check if Quick. tag already exists
        if 'quick.' in description_lower:
            print(f"Skipping {file_path.name} - already has Quick. tag")
            return False
        
        # Add Quick. as the second tag
        # The format is typically: _Ability type. Other tags._
        # We want to make it: _Ability type. Quick. Other tags._
        
        # Extract the content between underscores
        match = re.match(r'^_(.+)_$', description_line)
        if match:
            inner_content = match.group(1)
            # Split by '. ' to separate tags
            parts = inner_content.split('. ')
            if len(parts) >= 1:
                # Insert Quick. as the second tag
                parts.insert(1, 'Quick')
                new_inner_content = '. '.join(parts)
            else:
                new_inner_content = f"{inner_content}. Quick"
            new_description_line = f"_{new_inner_content}_"
            
            # Replace the line
            lines[description_line_index] = new_description_line
            
            # Write back to file
            new_content = '\n'.join(lines)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print(f"✓ Added Quick. tag to {file_path.name}")
            return True
        else:
            print(f"Warning: Could not parse description line in {file_path}")
            return False
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main function to process all talent files."""
    
    # Get the script directory and find the talents directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    talents_dir = project_root / "heart_rush" / "talents"
    
    if not talents_dir.exists():
        print(f"Error: Talents directory not found at {talents_dir}")
        return
    
    print(f"Processing talent files in {talents_dir}")
    print("=" * 50)
    
    modified_count = 0
    total_count = 0
    
    # Process combat talents
    combat_dir = talents_dir / "combat_talents"
    if combat_dir.exists():
        print("\nProcessing combat talents:")
        for file_path in sorted(combat_dir.glob("*.md")):
            total_count += 1
            if process_talent_file(file_path):
                modified_count += 1
    
    # Process non-combat talents
    noncombat_dir = talents_dir / "noncombat_talents"
    if noncombat_dir.exists():
        print("\nProcessing non-combat talents:")
        for file_path in sorted(noncombat_dir.glob("*.md")):
            total_count += 1
            if process_talent_file(file_path):
                modified_count += 1
    
    print("\n" + "=" * 50)
    print(f"Processing complete!")
    print(f"Total files processed: {total_count}")
    print(f"Files modified: {modified_count}")
    print(f"Files skipped: {total_count - modified_count}")

if __name__ == "__main__":
    main()