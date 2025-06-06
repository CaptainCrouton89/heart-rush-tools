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

def create_section_files(json_file_path, output_dir):
    """Create individual markdown files for each section from the JSON."""
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Load the JSON data
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Create a file for each section
    for section_name, content in data.items():
        # Create a safe filename
        safe_filename = sanitize_filename(section_name)
        file_path = os.path.join(output_dir, f"{safe_filename}.md")
        
        # Write the content to the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"Created: {file_path} ({len(content)} characters)")

if __name__ == "__main__":
    json_file = "/Users/silasrhyneer/Code/heart-rush-tools/HeartRushRules.json"
    output_directory = "/Users/silasrhyneer/Code/heart-rush-tools/sections"
    
    try:
        create_section_files(json_file, output_directory)
        print(f"\nAll section files created in: {output_directory}")
        
    except Exception as e:
        print(f"Error: {e}")