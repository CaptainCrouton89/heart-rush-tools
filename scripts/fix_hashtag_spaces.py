#!/usr/bin/env python3
"""
Script to remove spaces between # symbols in HeartRushRules.md
"""

import re

def fix_hashtag_spaces(file_path):
    """Remove spaces between consecutive # symbols"""
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Pattern to match multiple # symbols with spaces between them
    # This will match patterns like "# #", "# # #", etc.
    pattern = r'#(\s+#)+'
    
    def replace_hashtags(match):
        # Count the number of # symbols in the match
        hashtag_count = match.group().count('#')
        # Return the same number of # symbols without spaces
        return '#' * hashtag_count
    
    # Apply the replacement
    fixed_content = re.sub(pattern, replace_hashtags, content)
    
    # Write the fixed content back to the file
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(fixed_content)
    
    print(f"Fixed hashtag spacing in {file_path}")

if __name__ == "__main__":
    fix_hashtag_spaces("HeartRushRules.md")