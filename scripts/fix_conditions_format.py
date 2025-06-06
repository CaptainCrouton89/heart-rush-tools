#!/usr/bin/env python3
"""
Script to fix formatting issues in Conditions.md:
1. Convert bullet-point conditions to proper headers (###)
2. Italicize and properly space the "leveled. fading" style subheaders
"""

import re
import sys
from pathlib import Path

def fix_conditions_format(content: str) -> str:
    """
    Fix the formatting of conditions in the markdown content.
    
    Args:
        content: The raw markdown content
        
    Returns:
        The formatted content with proper headers and styling
    """
    lines = content.split('\n')
    result_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this is a condition bullet point (starts with "- " followed by a condition name)
        condition_match = re.match(r'^- ([A-Za-z\-\s]+)\s*$', line)
        
        if condition_match:
            condition_name = condition_match.group(1).strip()
            
            # Convert to header
            result_lines.append(f"### {condition_name}")
            result_lines.append("")  # Add blank line after header
            
            # Check if the next line is a type descriptor (leveled, fading, ongoing)
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                type_match = re.match(r'^\s*((?:Leveled\.?\s*)?(?:Fading\.?\s*)?(?:Ongoing\.?\s*)?)\s*$', next_line, re.IGNORECASE)
                
                if type_match and next_line:
                    # Format as italics with proper spacing
                    type_text = type_match.group(1).strip()
                    if type_text:
                        result_lines.append("")  # Blank line before
                        result_lines.append(f"*{type_text}*")
                        result_lines.append("")  # Blank line after
                    i += 1  # Skip the next line since we processed it
            
        else:
            # Keep other lines as-is
            result_lines.append(line)
        
        i += 1
    
    return '\n'.join(result_lines)

def main():
    """Main function to process the Conditions.md file."""
    conditions_file = Path("heart_rush/all_sections_formatted/Conditions.md")
    
    if not conditions_file.exists():
        print(f"Error: {conditions_file} not found!")
        sys.exit(1)
    
    # Read the original content
    with open(conditions_file, 'r', encoding='utf-8') as f:
        original_content = f.read()
    
    # Fix the formatting
    fixed_content = fix_conditions_format(original_content)
    
    # Write back to file
    with open(conditions_file, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print(f"Successfully fixed formatting in {conditions_file}")

if __name__ == "__main__":
    main()