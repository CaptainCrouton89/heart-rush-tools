#!/usr/bin/env python3
"""
Script to combine all markdown sections into a master document in logical order.
"""

import os
from pathlib import Path

def get_logical_order():
    """Define the logical order for combining sections."""
    return [
        "Gameplay_Basics_Part1.md",
        "Gameplay_Basics_Part2.md",
        "Building_Your_Character_Part1.md",
        "Building_Your_Character_Part2.md",
        "Classes_Part1.md",
        "Classes_Part2.md",
        "Classes_Part3.md",
        "Classes_Part4.md",
        "Talents_Part1.md",
        "Talents_Part2.md",
        "Talents_Part3.md",
        "Talents_Part4.md",
        "Talents_Part5.md",
        "Talents_Part6.md",
        "Talents_Part7.md",
        "Talents_Part8.md",
        "Paragon_Abilities.md",
        "Kethic_Elementalism_Part1.md",
        "Kethic_Elementalism_Part2.md",
        "Kethic_Elementalism_Part3.md",
        "Kethic_Elementalism_Part4.md",
        "Combat_Part1.md",
        "Combat_Part2.md",
        "Combat_Part3.md",
        "Conditions.md",
        "Equipment_&_Gear.md",
        "Weapons,_Cantrips_&_Armor.md",
        "Rests_&_Healing.md",
        "Basic_Needs.md",
        "Journeys_Part1.md",
        "Journeys_Part2.md",
        "Downtime_Activity_(WIP).md",
        "Traders_&_Merchants.md"
    ]

def combine_sections():
    """Combine all markdown sections into a master document."""
    sections_dir = Path("sections_test_formatted")
    output_file = Path("master_document.md")
    
    if not sections_dir.exists():
        print(f"Error: {sections_dir} directory not found")
        return
    
    logical_order = get_logical_order()
    combined_content = []
    
    # Add files in logical order
    for filename in logical_order:
        file_path = sections_dir / filename
        if file_path.exists():
            print(f"Adding: {filename}")
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                combined_content.append(content)
                combined_content.append("")  # Add blank line between sections
        else:
            print(f"Warning: {filename} not found")
    
    # Check for any files not in the logical order
    all_md_files = set(f.name for f in sections_dir.glob("*.md"))
    ordered_files = set(logical_order)
    missing_files = all_md_files - ordered_files
    
    if missing_files:
        print(f"\nWarning: The following files were not included in the logical order:")
        for filename in sorted(missing_files):
            print(f"  - {filename}")
    
    # Write combined content
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(combined_content))
    
    print(f"\nCombined document saved as: {output_file}")
    print(f"Total sections processed: {len([f for f in logical_order if (sections_dir / f).exists()])}")

if __name__ == "__main__":
    combine_sections()