#!/usr/bin/env python3
"""
Script to fix the formatting of Paragon_Abilities.md to match the format of Talents.md
(but without destiny levels since paragon abilities don't have them)
"""

import re
import sys

def fix_paragon_abilities_format(input_file, output_file):
    """
    Fix the formatting of Paragon_Abilities.md to match Talents.md format
    """
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split into sections by ability names (starting with ##)
    sections = re.split(r'\n## ([^\n]+)\n', content)
    
    # First section is the header
    result = sections[0]
    
    # Process each ability section
    for i in range(1, len(sections), 2):
        if i + 1 < len(sections):
            ability_name = sections[i]
            ability_content = sections[i + 1]
            
            # Add the ability header as H3
            result += f"\n### {ability_name}\n\n"
            
            # Process the content
            lines = ability_content.strip().split('\n')
            
            # Find the metadata line (first bullet point with ability info)
            metadata_line = None
            description_lines = []
            found_metadata = False
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # Check if this is the first bullet point with ability metadata
                if line.startswith('- ') and not found_metadata:
                    info = line[2:].strip()
                    if info and any(keyword in info.lower() for keyword in ['ability', 'subclass:', 'class:', 'talent:', 'pl:']):
                        metadata_line = info
                        found_metadata = True
                    else:
                        # This is description content in bullet form
                        description_lines.append(line)
                else:
                    # This is description content
                    description_lines.append(line)
            
            # Create the italicized metadata line
            if metadata_line:
                # Clean up the metadata formatting
                metadata_line = re.sub(r'\.\s*([A-Z])', r'. \1', metadata_line)
                if not metadata_line.endswith('.'):
                    metadata_line += '.'
                result += f"_{metadata_line}_\n\n"
            
            # Process description lines
            if description_lines:
                # Join consecutive non-bullet lines into paragraphs
                current_paragraph = []
                for line in description_lines:
                    line = line.strip()
                    if line.startswith('- '):
                        # Finish current paragraph if any
                        if current_paragraph:
                            result += ' '.join(current_paragraph) + '\n\n'
                            current_paragraph = []
                        # Add bullet point
                        result += line + '\n'
                    elif line:
                        current_paragraph.append(line)
                    else:
                        # Empty line - finish paragraph
                        if current_paragraph:
                            result += ' '.join(current_paragraph) + '\n\n'
                            current_paragraph = []
                
                # Add any remaining paragraph
                if current_paragraph:
                    result += ' '.join(current_paragraph) + '\n'
            
            result += '\n'
    
    # Write the result
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(result)

if __name__ == "__main__":
    input_file = "/Users/silasrhyneer/Code/heart-rush-tools/heart_rush/all_sections_formatted/Paragon_Abilities.md"
    output_file = input_file  # Overwrite the original file
    
    fix_paragon_abilities_format(input_file, output_file)
    print(f"Fixed formatting in {output_file}")