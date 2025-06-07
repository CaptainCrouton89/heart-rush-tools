#!/usr/bin/env python3
"""
Script to clean up special characters in markdown files, replacing them with standard ones.
"""

import sys

def clean_special_chars(text):
    """Clean up special characters and replace with standard equivalents."""
    replacements = {
        # Smart quotes
        '"': '"',
        '"': '"',
        ''': "'",
        ''': "'",
        # Em dashes and en dashes
        '—': '--',
        '–': '-',
        # Other common special characters
        '…': '...',
        '®': '(R)',
        '™': '(TM)',
        '©': '(C)',
        # Non-breaking space
        '\u00A0': ' ',
        # Other unicode quotes
        '„': '"',
        '‚': "'",
        '‹': '<',
        '›': '>',
        '«': '<<',
        '»': '>>',
    }
    
    for old, new in replacements.items():
        text = text.replace(old, new)
    
    return text

def main():
    if len(sys.argv) != 2:
        print("Usage: python clean_special_chars.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        cleaned_content = clean_special_chars(content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(cleaned_content)
        
        print(f"Successfully cleaned special characters in {file_path}")
        
    except Exception as e:
        print(f"Error processing file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()