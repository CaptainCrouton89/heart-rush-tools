#!/usr/bin/env python3
import json
import re


def parse_markdown_to_json(file_path):
    """Parse markdown file into JSON structure with only ## headers as keys."""
    
    result = {}
    current_header = None
    current_content = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.rstrip()
            
            # Check for main headers (##)
            if line.startswith('## ') and not line.startswith('### '):
                # Save previous content if exists
                if current_header and current_content:
                    result[current_header] = '\n'.join(current_content).strip()
                
                # Start new header
                current_header = line[3:].strip()
                current_content = [line]  # Include the ## header as first line
                
            else:
                # All other content (including ###, ####, etc.)
                if current_header:  # Only collect content if we're under a header
                    current_content.append(line)
    
    # Save final content
    if current_header and current_content:
        result[current_header] = '\n'.join(current_content).strip()
    
    return result

if __name__ == "__main__":
    input_file = "/Users/silasrhyneer/Code/heart-rush-tools/HeartRushRules.md"
    output_file = "/Users/silasrhyneer/Code/heart-rush-tools/HeartRushRules.json"
    
    try:
        parsed_data = parse_markdown_to_json(input_file)
        
        # Write to JSON file with pretty formatting
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(parsed_data, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully parsed {input_file} to {output_file}")
        print(f"Found {len(parsed_data)} main sections:")
        for header in parsed_data.keys():
            content_length = len(parsed_data[header])
            print(f"  - {header} ({content_length} characters)")
            
    except Exception as e:
        print(f"Error: {e}")