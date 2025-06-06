#!/usr/bin/env python3
import os
import re

def split_talents_section():
    """Split the large Talents.md file into smaller, more manageable sections."""
    
    talents_file = "/Users/silasrhyneer/Code/heart-rush-tools/sections/Talents.md"
    output_dir = "/Users/silasrhyneer/Code/heart-rush-tools/sections"
    
    # Read the talents file
    with open(talents_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split into sections based on major headings and content structure
    sections = []
    
    # Find the main section breaks
    lines = content.split('\n')
    
    # Section 1: Introduction and Types (lines 1-85 approximately)
    intro_end = None
    combat_start = None
    noncombat_start = None
    
    for i, line in enumerate(lines):
        if line.strip() == "Combat Talents" and intro_end is None:
            intro_end = i
            combat_start = i
            print(f"Found Combat Talents at line {i}")
        elif line.strip() == "Noncombat" and noncombat_start is None:
            noncombat_start = i
            print(f"Found Noncombat section at line {i}")
            break
    
    # Create the sections
    if intro_end and combat_start and noncombat_start:
        # Talents Introduction
        intro_content = '\n'.join(lines[:intro_end])
        sections.append(("Talents_Introduction", intro_content))
        
        # Combat Talents - split this further since it's very long
        combat_content = '\n'.join(lines[combat_start:noncombat_start])
        combat_talents = split_combat_talents(combat_content)
        sections.extend(combat_talents)
        
        # Noncombat Talents - also split this since it's long
        noncombat_content = '\n'.join(lines[noncombat_start:])
        noncombat_talents = split_noncombat_talents(noncombat_content)
        sections.extend(noncombat_talents)
    
    # Write each section to a separate file
    for section_name, section_content in sections:
        file_path = os.path.join(output_dir, f"{section_name}.md")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(section_content)
        print(f"Created: {file_path} ({len(section_content)} characters)")

def split_combat_talents(content):
    """Split combat talents into smaller chunks based on alphabetical groups."""
    lines = content.split('\n')
    sections = []
    current_section = []
    current_name = ""
    talent_count = 0
    
    # Group talents alphabetically (A-F, G-M, N-Z)
    for line in lines:
        # Check if this is a talent name (not in a code block and appears to be a title)
        if (line.strip() and 
            not line.startswith('```') and 
            not line.startswith('-') and
            not line.startswith('Destiny Level') and
            not 'ability.' in line.lower() and
            len(line.strip()) < 50 and
            re.match(r'^[A-Z]', line.strip())):
            
            first_letter = line.strip()[0].upper()
            
            # Determine which group this belongs to
            if first_letter <= 'F':
                group = "Combat_Talents_A_F"
            elif first_letter <= 'M':
                group = "Combat_Talents_G_M"
            else:
                group = "Combat_Talents_N_Z"
            
            # If we're starting a new group, save the current one
            if current_name and current_name != group and current_section:
                sections.append((current_name, '\n'.join(current_section)))
                current_section = []
                talent_count = 0
            
            current_name = group
            talent_count += 1
        
        current_section.append(line)
        
        # Also split if a single group gets too long (>40 talents or >15000 chars)
        if talent_count > 40 or len('\n'.join(current_section)) > 15000:
            if current_section:
                suffix = "_Part1" if "_Part" not in current_name else "_Part2"
                sections.append((current_name + suffix, '\n'.join(current_section)))
                current_section = []
                talent_count = 0
                current_name = current_name.replace("_Part1", "_Part2").replace("_Part2", "_Part3")
    
    # Add the final section
    if current_section:
        sections.append((current_name, '\n'.join(current_section)))
    
    return sections

def split_noncombat_talents(content):
    """Split noncombat talents into smaller chunks."""
    lines = content.split('\n')
    sections = []
    current_section = []
    current_name = "Noncombat_Talents"
    talent_count = 0
    part_num = 1
    
    for line in lines:
        # Check if this is a talent name
        if (line.strip() and 
            not line.startswith('```') and 
            not line.startswith('-') and
            not line.startswith('Destiny Level') and
            not 'ability.' in line.lower() and
            len(line.strip()) < 50 and
            re.match(r'^[A-Z]', line.strip())):
            talent_count += 1
        
        current_section.append(line)
        
        # Split if we have too many talents or content is too long
        if talent_count >= 25 or len('\n'.join(current_section)) > 12000:
            if current_section:
                sections.append((f"{current_name}_Part{part_num}", '\n'.join(current_section)))
                current_section = []
                talent_count = 0
                part_num += 1
    
    # Add the final section
    if current_section:
        sections.append((f"{current_name}_Part{part_num}", '\n'.join(current_section)))
    
    return sections

if __name__ == "__main__":
    try:
        split_talents_section()
        print("\nTalents section successfully split into smaller files!")
        
    except Exception as e:
        print(f"Error: {e}")