#!/usr/bin/env python3
"""
Script to fix formatting inconsistencies in Noncombat_Talents.md
and prepare it for appending to Talents.md
"""

import re

def fix_noncombat_talents_formatting():
    # Read the noncombat talents file
    with open('/Users/silasrhyneer/Code/heart-rush-tools/heart_rush/all_sections_formatted/Noncombat_Talents.md', 'r') as f:
        content = f.read()
    
    # Apply regex fixes to match the formatting style of Talents.md
    
    # 1. Fix talent headers - ensure they use ### instead of ##
    content = re.sub(r'^## ([A-Z])', r'### \1', content, flags=re.MULTILINE)
    
    # 2. Fix ability type formatting - ensure it's italic with underscores
    # Pattern: look for lines that describe abilities but aren't properly formatted
    content = re.sub(
        r'^([A-Z][a-z]+ ability\.[^_]*?)\.(\s*)$',
        r'_\1._\2',
        content,
        flags=re.MULTILINE
    )
    
    # More specific fixes for ability descriptions
    content = re.sub(
        r'^(Heart ability\. Handmagic\.)(\s*)$',
        r'_\1_\2',
        content,
        flags=re.MULTILINE
    )
    
    content = re.sub(
        r'^(Passive ability\. [^.]+\.)(\s*)$',
        r'_\1_\2',
        content,
        flags=re.MULTILINE
    )
    
    content = re.sub(
        r'^(Major ability\. [^.]+\.)(\s*)$',
        r'_\1_\2',
        content,
        flags=re.MULTILINE
    )
    
    content = re.sub(
        r'^(Weekly ability\. [^.]+\.)(\s*)$',
        r'_\1_\2',
        content,
        flags=re.MULTILINE
    )
    
    content = re.sub(
        r'^(Monthly ability\. [^.]+\.)(\s*)$',
        r'_\1_\2',
        content,
        flags=re.MULTILINE
    )
    
    # 3. Fix "Destiny level" to "Destiny Level:" format
    content = re.sub(
        r'\*\*Destiny level\*\*',
        r'**Destiny Level:**',
        content
    )
    
    content = re.sub(
        r'\*\*Destiny Level\*\*',
        r'**Destiny Level:**',
        content
    )
    
    # 4. Ensure consistent spacing around headers
    content = re.sub(r'\n### ', r'\n\n### ', content)
    content = re.sub(r'\n\n\n### ', r'\n\n### ', content)  # Remove triple newlines
    
    # 5. Remove the main header since it will be appended to existing file
    content = re.sub(r'^# Noncombat Talents\n\n', '', content)
    
    return content

def append_to_talents_file(formatted_content):
    """Append the formatted noncombat talents to the main Talents.md file"""
    
    # Add a section header for noncombat talents
    noncombat_section = "\n\n## Noncombat Talents\n\nThe talents in this section are noncombat-related talents. This categorization is for the ease of finding talents, and has no other effect.\n\n"
    
    # Append to the talents file
    with open('/Users/silasrhyneer/Code/heart-rush-tools/heart_rush/all_sections_formatted/Talents.md', 'a') as f:
        f.write(noncombat_section)
        f.write(formatted_content)
    
    print("Successfully appended noncombat talents to Talents.md")

if __name__ == "__main__":
    print("Fixing noncombat talents formatting...")
    formatted_content = fix_noncombat_talents_formatting()
    
    print("Appending to Talents.md...")
    append_to_talents_file(formatted_content)
    
    print("Done!")