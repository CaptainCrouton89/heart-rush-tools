#!/usr/bin/env python3
import json
import os
import re

def sanitize_filename(filename):
    """Convert a string to a safe filename by removing/replacing problematic characters."""
    # Replace spaces and problematic characters with underscores
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    filename = re.sub(r'\s+', '_', filename)
    # Remove multiple consecutive underscores
    filename = re.sub(r'_+', '_', filename)
    # Remove leading/trailing underscores
    filename = filename.strip('_')
    return filename

def split_by_character_count(content, target_size=12000, section_name="Section"):
    """Split content into chunks based on character count, trying to break at natural points."""
    if len(content) <= target_size:
        return [(section_name, content)]
    
    lines = content.split('\n')
    sections = []
    current_section = []
    current_size = 0
    part_num = 1
    
    for line in lines:
        current_section.append(line)
        current_size += len(line) + 1  # +1 for newline
        
        # Check if we should split here
        if current_size >= target_size:
            # Try to find a good breaking point (empty line or talent name)
            for i in range(len(current_section) - 1, max(0, len(current_section) - 50), -1):
                if (current_section[i].strip() == "" or
                    (current_section[i].strip() and 
                     not current_section[i].startswith(' ') and
                     not current_section[i].startswith('\t') and
                     len(current_section[i].strip()) < 50 and
                     re.match(r'^[A-Z]', current_section[i].strip()))):
                    
                    # Split here
                    sections.append((f"{section_name}_Part{part_num}", '\n'.join(current_section[:i+1])))
                    current_section = current_section[i+1:]
                    current_size = sum(len(line) + 1 for line in current_section)
                    part_num += 1
                    break
            else:
                # No good break point found, split anyway
                sections.append((f"{section_name}_Part{part_num}", '\n'.join(current_section)))
                current_section = []
                current_size = 0
                part_num += 1
    
    # Add remaining content
    if current_section:
        sections.append((f"{section_name}_Part{part_num}", '\n'.join(current_section)))
    
    return sections

def process_large_sections():
    """Process large sections and split them into manageable chunks."""
    sections_dir = "/Users/silasrhyneer/Code/heart-rush-tools/sections"
    
    # Read all existing sections
    section_files = [f for f in os.listdir(sections_dir) if f.endswith('.md')]
    
    large_sections = []
    
    for filename in section_files:
        filepath = os.path.join(sections_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if this section is too large (>15000 characters)
        if len(content) > 15000:
            large_sections.append((filename, content))
            print(f"Found large section: {filename} ({len(content)} characters)")
    
    # Process each large section
    for filename, content in large_sections:
        section_name = filename.replace('.md', '')
        print(f"\nProcessing {section_name}...")
        
        # Split the content
        split_sections = split_by_character_count(content, target_size=12000, section_name=section_name)
        
        # Only create split files if we actually split it
        if len(split_sections) > 1:
            # Remove the original large file
            os.remove(os.path.join(sections_dir, filename))
            print(f"Removed original large file: {filename}")
            
            # Create the split files
            for split_name, split_content in split_sections:
                split_filename = f"{split_name}.md"
                split_filepath = os.path.join(sections_dir, split_filename)
                with open(split_filepath, 'w', encoding='utf-8') as f:
                    f.write(split_content)
                print(f"Created: {split_filename} ({len(split_content)} characters)")
        else:
            print(f"Section {section_name} doesn't need splitting")

if __name__ == "__main__":
    try:
        # First, clean up the mess from the previous script
        sections_dir = "/Users/silasrhyneer/Code/heart-rush-tools/sections"
        cleanup_files = [f for f in os.listdir(sections_dir) if f.startswith('Combat_Talents_') or f.startswith('Talents_Introduction')]
        
        for file in cleanup_files:
            os.remove(os.path.join(sections_dir, file))
            print(f"Cleaned up: {file}")
        
        # Now process large sections
        process_large_sections()
        print("\nLarge sections successfully processed!")
        
    except Exception as e:
        print(f"Error: {e}")