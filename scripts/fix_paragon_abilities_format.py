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
            
            # Extract ability info from the first bullet point(s)
            ability_info_parts = []
            description_lines = []
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # Check if this is a bullet point with ability info
                if line.startswith('- '):
                    # Remove the bullet and add to ability info
                    info = line[2:].strip()
                    if info:
                        # Check if this looks like ability metadata (contains keywords)
                        if any(keyword in info.lower() for keyword in ['ability', 'subclass:', 'class:', 'talent:', 'pl:']):
                            ability_info_parts.append(info)
                        else:
                            # This is description content in bullet form
                            description_lines.append(line)
                else:
                    # This is description content
                    description_lines.append(line)
            
            # Create the italicized ability info line
            if ability_info_parts:
                ability_info = ' '.join(ability_info_parts)
                # Clean up periods - remove duplicate periods and ensure proper spacing
                ability_info = re.sub(r'\.+', '.', ability_info)
                ability_info = re.sub(r'\.\s*([A-Z])', r'. \1', ability_info)
                if not ability_info.endswith('.'):
                    ability_info += '.'
                result += f"_{ability_info}_\n\n"
            
            # Add description lines, ensuring proper paragraph spacing
            current_paragraph = []
            for line in description_lines:
                line = line.strip()
                if line:
                    current_paragraph.append(line)
                else:
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