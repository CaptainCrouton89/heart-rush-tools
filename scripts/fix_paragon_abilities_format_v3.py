#!/usr/bin/env python3
"""
Script to fix the formatting of Paragon_Abilities.md to match the format of Talents.md
Only the metadata (ability type, subclass, etc.) should be italicized, not the description.
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
            
            # Extract metadata and description
            metadata_parts = []
            description_lines = []
            found_metadata = False
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # Check if this is the first bullet point with metadata
                if line.startswith('- ') and not found_metadata:
                    info = line[2:].strip()
                    if info:
                        # Split by periods to separate metadata from description
                        parts = info.split('.')
                        for j, part in enumerate(parts):
                            part = part.strip()
                            if not part:
                                continue
                            # Check if this part contains metadata keywords
                            if any(keyword in part.lower() for keyword in ['ability', 'subclass:', 'class:', 'talent:', 'pl:']):
                                metadata_parts.append(part)
                            else:
                                # This and remaining parts are description
                                remaining_desc = '. '.join(parts[j:]).strip()
                                if remaining_desc:
                                    description_lines.append(remaining_desc)
                                break
                        found_metadata = True
                else:
                    # This is description content
                    description_lines.append(line)
            
            # Create the italicized metadata line
            if metadata_parts:
                metadata = '. '.join(metadata_parts)
                if not metadata.endswith('.'):
                    metadata += '.'
                result += f"_{metadata}_\n\n"
            
            # Add description lines as normal text
            if description_lines:
                for line in description_lines:
                    line = line.strip()
                    if line:
                        if line.startswith('- '):
                            result += line + '\n'
                        else:
                            result += line + '\n'
                result += '\n'
            
            result += '\n'
    
    # Write the result
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(result)

if __name__ == "__main__":
    input_file = "/Users/silasrhyneer/Code/heart-rush-tools/heart_rush/all_sections_formatted/Paragon_Abilities.md"
    output_file = input_file  # Overwrite the original file
    
    fix_paragon_abilities_format(input_file, output_file)
    print(f"Fixed formatting in {output_file}")