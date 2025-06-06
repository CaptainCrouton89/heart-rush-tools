#!/usr/bin/env python3
"""
Script to fix italics formatting in Paragon_Abilities.md
After the subclass declaration (ending with ..), the text should be normal, not italic.
"""

import re

def fix_paragon_abilities_formatting(file_path):
    """
    Fix the formatting issue where text after subclass declarations is incorrectly italicized.
    
    Pattern: _text.. more text_
    Should become: _text._ more text
    """
    
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Regex pattern to match italic text that contains ".." and continues with more text
    # This pattern looks for: _text.. more text_
    # And replaces it with: _text._ more text
    pattern = r'_([^_]*?\.\.)([^_]*?)_'
    
    def replacement(match):
        before_dots = match.group(1)  # Text before and including the double dots
        after_dots = match.group(2)   # Text after the double dots
        
        # Return the corrected format: _text._ remaining_text
        return f'_{before_dots[:-1]}._{after_dots}'
    
    # Apply the regex replacement
    fixed_content = re.sub(pattern, replacement, content)
    
    # Write the fixed content back to the file
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(fixed_content)
    
    print(f"Fixed formatting in {file_path}")
    
    # Count how many replacements were made
    matches = re.findall(pattern, content)
    print(f"Fixed {len(matches)} formatting issues")

if __name__ == "__main__":
    file_path = "/Users/silasrhyneer/Code/heart-rush-tools/heart_rush/all_sections_formatted/Paragon_Abilities.md"
    fix_paragon_abilities_formatting(file_path)