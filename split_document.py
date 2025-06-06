#!/usr/bin/env python3
"""
Heart Rush Rules Document Splitter
Splits the large HeartRushRules.md into organized folders based on header structure.
"""

import re
from pathlib import Path
import shutil

def sanitize_filename(name):
    """Convert header text to safe filename/folder name."""
    # Remove markdown formatting
    name = re.sub(r'[*_`]', '', name)
    # Replace problematic characters
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    # Replace spaces and special chars with underscores
    name = re.sub(r'[\s\-&]+', '_', name)
    # Remove multiple underscores
    name = re.sub(r'_+', '_', name)
    # Remove leading/trailing underscores
    name = name.strip('_')
    # Limit length
    if len(name) > 50:
        name = name[:50].rstrip('_')
    return name or 'untitled'

def split_document(file_path, output_dir):
    """Split the Heart Rush rules document into organized folders."""
    
    output_path = Path(output_dir)
    if output_path.exists():
        print(f"🗑️  Removing existing {output_path}")
        shutil.rmtree(output_path)
    
    output_path.mkdir(parents=True)
    print(f"📁 Created output directory: {output_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # Parse headers and their positions
    headers = []
    header_pattern = re.compile(r'^(#{1,6})\s+(.+)$')
    
    for i, line in enumerate(lines):
        match = header_pattern.match(line)
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()
            headers.append((level, title, i))
    
    print(f"📋 Found {len(headers)} headers")
    
    # Create folder structure and split content
    current_path = output_path
    path_stack = [output_path]  # Stack to track current path hierarchy
    level_stack = [0]  # Stack to track header levels
    
    for i, (level, title, line_num) in enumerate(headers):
        # Determine content for this section
        start_line = line_num
        end_line = headers[i + 1][2] if i + 1 < len(headers) else len(lines)
        section_content = '\n'.join(lines[start_line:end_line])
        
        # Clean up the file and folder name
        safe_title = sanitize_filename(title)
        
        # Adjust path stack based on header level
        while len(level_stack) > 1 and level <= level_stack[-1]:
            path_stack.pop()
            level_stack.pop()
        
        # If this is a deeper level, create subfolder
        if level > level_stack[-1]:
            current_path = path_stack[-1] / safe_title
            current_path.mkdir(parents=True, exist_ok=True)
            path_stack.append(current_path)
            level_stack.append(level)
        else:
            # Same level or back to parent level
            current_path = path_stack[-1].parent / safe_title
            current_path.mkdir(parents=True, exist_ok=True)
            path_stack[-1] = current_path
            level_stack[-1] = level
        
        # Write the section content
        file_name = f"{safe_title}.md"
        file_path = current_path / file_name
        
        # Ensure we don't overwrite by adding numbers if needed
        counter = 1
        while file_path.exists():
            file_name = f"{safe_title}_{counter}.md"
            file_path = current_path / file_name
            counter += 1
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(section_content)
        
        print(f"📄 Created: {file_path.relative_to(output_path)}")
    
    # Create an index file with the overall structure
    create_index_file(output_path, headers)
    
    print(f"\n✅ Document split complete!")
    print(f"📁 Output directory: {output_path}")
    print(f"📊 Created {len(headers)} section files")

def create_index_file(output_path, headers):
    """Create an index.md file showing the document structure."""
    
    index_content = ["# Heart Rush Rules - Document Structure\n"]
    index_content.append("This directory contains the Heart Rush rules split into organized sections.\n")
    index_content.append("## Document Structure\n")
    
    current_level = 0
    for level, title, line_num in headers:
        indent = "  " * (level - 1)
        safe_title = sanitize_filename(title)
        # Create relative path to the file
        if level == 1:
            file_path = f"{safe_title}/{safe_title}.md"
        else:
            file_path = f"*/{safe_title}.md"  # Simplified for index
        
        index_content.append(f"{indent}- [{title}]({file_path}) (line {line_num})")
    
    index_content.append(f"\n## Statistics\n")
    index_content.append(f"- Total sections: {len(headers)}")
    
    level_counts = {}
    for level, _, _ in headers:
        level_counts[level] = level_counts.get(level, 0) + 1
    
    for level in sorted(level_counts.keys()):
        index_content.append(f"- Level {level} headers: {level_counts[level]}")
    
    with open(output_path / "index.md", 'w', encoding='utf-8') as f:
        f.write('\n'.join(index_content))
    
    print(f"📋 Created index file: {output_path / 'index.md'}")

def main():
    rules_file = Path("HeartRushRules.md")
    if not rules_file.exists():
        print(f"❌ Error: {rules_file} not found in current directory")
        return
    
    output_dir = "data"
    print("📁 Starting document split...")
    split_document(rules_file, output_dir)

if __name__ == "__main__":
    main()