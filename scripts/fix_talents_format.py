#!/usr/bin/env python3

import re
import sys

def fix_talents_formatting(content):
    """
    Fix the markdown formatting for talents:
    1. Convert bullet points to headers
    2. Format ability types in italics
    3. Bold destiny levels and put on separate lines
    """
    
    # Split content into lines
    lines = content.split('\n')
    result_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if this is a talent bullet point (starts with "- " and is followed by a talent name)
        if re.match(r'^- [A-Z][^.]*$', line.strip()):
            # Extract talent name (remove the "- " prefix)
            talent_name = line.strip()[2:]
            
            # Convert to header
            result_lines.append(f"### {talent_name}")
            result_lines.append("")  # Add blank line after header
            
            # Process the next lines that belong to this talent
            i += 1
            
            # Look for the ability description line (usually the next line with indentation)
            while i < len(lines) and (lines[i].strip() == "" or lines[i].startswith("  ")):
                current_line = lines[i].strip()
                
                if current_line == "":
                    result_lines.append("")
                    i += 1
                    continue
                
                # Check if this line contains ability types (like "Major ability. Handmagic.")
                ability_types_pattern = r'^((?:Major|Heart|Passive|Weekly|Monthly) ability\.?(?:\s+(?:Instant|Full action)\.?)?(?:\s+(?:Handmagic|Martial talent|Cognitive talent|Gaeic melody)\.?)?(?:\s+Prerequisite:[^.]*\.?)?)(.*)$'
                ability_match = re.match(ability_types_pattern, current_line)
                
                if ability_match:
                    # Put ability types in italics
                    ability_types = ability_match.group(1).strip()
                    remaining_text = ability_match.group(2).strip()
                    
                    result_lines.append(f"*{ability_types}*")
                    if remaining_text:
                        result_lines.append(remaining_text)
                    result_lines.append("")
                else:
                    # Check for destiny level pattern
                    destiny_pattern = r'^(.*?)\s*Destiny [Ll]evel:?\s*(.*)$'
                    destiny_match = re.match(destiny_pattern, current_line)
                    
                    if destiny_match:
                        # Add the text before "Destiny Level" if it exists
                        before_text = destiny_match.group(1).strip()
                        destiny_text = destiny_match.group(2).strip()
                        
                        if before_text:
                            result_lines.append(before_text)
                        
                        # Add destiny level on its own line, bolded
                        result_lines.append("")
                        result_lines.append("**Destiny Level:**")
                        result_lines.append(destiny_text)
                    else:
                        # Regular content line
                        result_lines.append(current_line)
                
                i += 1
                
            # Add extra blank line after talent
            if result_lines and result_lines[-1] != "":
                result_lines.append("")
                
        else:
            # Not a talent line, keep as is
            result_lines.append(line)
            i += 1
    
    return '\n'.join(result_lines)

def main():
    input_file = "/Users/silasrhyneer/Code/heart-rush-tools/heart_rush/all_sections_formatted/Talents.md"
    
    try:
        # Read the input file
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        print("Processing talents formatting...")
        
        # Apply formatting fixes
        fixed_content = fix_talents_formatting(content)
        
        # Write back to the file
        with open(input_file, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        
        print(f"Successfully fixed formatting in {input_file}")
        
    except Exception as e:
        print(f"Error processing file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()