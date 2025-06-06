#!/usr/bin/env python3
"""
Test Script for Heart Rush Sections Formatting
Processes select critical sections with nano-style formatting to test improvements.
"""

import asyncio
from pathlib import Path

from openai_config import create_completion_params, get_openai_client

# List of critical sections to format (most important game mechanics)
CRITICAL_SECTIONS = [
    "Combat_Part1.md",
    "Combat_Part2.md", 
    "Combat_Part3.md",
    "Journeys_Part1.md",
    "Journeys_Part2.md",
    "Basic_Needs.md",
    "Classes_Part1.md",
    "Classes_Part2.md",
    "Classes_Part3.md",
    "Classes_Part4.md",
    "Gameplay_Basics_Part1.md",
    "Gameplay_Basics_Part2.md",
    "Building_Your_Character_Part1.md",
    "Building_Your_Character_Part2.md",
    "Kethic_Elementalism_Part1.md",
    "Kethic_Elementalism_Part2.md",
    "Kethic_Elementalism_Part3.md",
    "Kethic_Elementalism_Part4.md",
    "Talents_Part1.md",
    "Talents_Part2.md",
    "Talents_Part3.md",
    "Talents_Part4.md",
    "Talents_Part5.md",
    "Talents_Part6.md",
    "Talents_Part7.md",
    "Talents_Part8.md",
    "Weapons,_Cantrips_&_Armor.md",
    "Conditions.md",
    "Traders_&_Merchants.md",
    "Stronghold.md",
    "Paragon_Abilities.md",
    "Downtime_Activity_(WIP).md",
    "Rests_&_Healing.md",
    "Equipment_&_Gear.md",
]

def get_critical_section_files(sections_dir):
    """Get the critical section files for testing."""
    
    sections_path = Path(sections_dir)
    if not sections_path.exists():
        raise FileNotFoundError(f"Sections directory {sections_path} not found")
    
    test_files = []
    missing_files = []
    
    for section_name in CRITICAL_SECTIONS:
        file_path = sections_path / section_name
        if file_path.exists():
            # Check file size
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if len(content.strip()) > 50:  # Skip empty/tiny files
                    test_files.append((file_path, len(content)))
                else:
                    print(f"⚠️  Skipping {section_name} (too small: {len(content)} chars)")
            except Exception as e:
                print(f"⚠️  Error reading {section_name}: {e}")
                missing_files.append(section_name)
        else:
            missing_files.append(section_name)
    
    if missing_files:
        print(f"⚠️  Missing files: {', '.join(missing_files)}")
    
    return test_files

async def format_section_with_openai(client, file_path, content):
    """Format a single section file using OpenAI API with nano-style improvements."""
    
    print(f"🤖 Processing: {file_path.name}")
    print(f"📏 Content length: {len(content)} characters")
    
    # Create enhanced prompt for Heart Rush rules formatting
    enhanced_prompt = f"""Please format and improve this Heart Rush TTRPG rules section. Focus on:

1. **Clean Structure**: Fix inconsistent headers, spacing, and markdown formatting
2. **Readability**: Improve paragraph breaks, bullet points, and table formatting  
3. **Game Mechanics**: Ensure dice notation (d4, d6, etc.) and game terms are consistent
4. **Navigation**: Make sure section headers are clear and well-organized
5. **Nano-style**: Apply clean, minimal formatting that's easy to read and navigate

Preserve all game content and mechanics exactly - only improve the formatting and structure.

---

{content}"""
    
    try:
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are an expert technical writer specializing in TTRPG rules formatting. You make rules clear, well-organized, and easy to reference during gameplay."
                    },
                    {"role": "user", "content": enhanced_prompt}
                ],
                max_tokens=16384,
                temperature=0.1
            )
        )
        
        formatted_content = response.choices[0].message.content.strip()
        
        # Calculate token usage
        prompt_tokens = response.usage.prompt_tokens
        completion_tokens = response.usage.completion_tokens
        total_tokens = response.usage.total_tokens
        
        print(f"✅ Formatted successfully")
        print(f"🎯 Tokens used: {total_tokens} (prompt: {prompt_tokens}, completion: {completion_tokens})")
        
        return formatted_content, total_tokens
        
    except Exception as e:
        print(f"❌ Error formatting file: {e}")
        return None, 0

def save_formatted_section(original_path, formatted_content, output_dir):
    """Save the formatted section to output directory."""
    
    output_path = Path(output_dir) / original_path.name
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save formatted content
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(formatted_content)
    
    print(f"💾 Saved to: {output_path}")
    return output_path

def compare_sections(original_path, formatted_path):
    """Compare original and formatted section files to show improvements."""
    
    with open(original_path, 'r', encoding='utf-8') as f:
        original = f.read()
    
    with open(formatted_path, 'r', encoding='utf-8') as f:
        formatted = f.read()
    
    # Basic comparison stats
    orig_lines = len(original.split('\n'))
    fmt_lines = len(formatted.split('\n'))
    orig_chars = len(original)
    fmt_chars = len(formatted)
    
    # Count headers for structure analysis
    orig_headers = original.count('##') + original.count('###') + original.count('####')
    fmt_headers = formatted.count('##') + formatted.count('###') + formatted.count('####')
    
    print(f"\n📊 COMPARISON FOR {original_path.name}")
    print(f"Original:  {orig_lines:4d} lines, {orig_chars:5d} chars, {orig_headers:2d} headers")
    print(f"Formatted: {fmt_lines:4d} lines, {fmt_chars:5d} chars, {fmt_headers:2d} headers")
    print(f"Change:    {fmt_lines-orig_lines:+4d} lines, {fmt_chars-orig_chars:+5d} chars, {fmt_headers-orig_headers:+2d} headers")
    
    # Show first few structural differences
    orig_lines_list = original.split('\n')
    fmt_lines_list = formatted.split('\n')
    
    differences = 0
    for i, (orig_line, fmt_line) in enumerate(zip(orig_lines_list, fmt_lines_list)):
        if orig_line.strip() != fmt_line.strip() and differences < 3:
            # Only show significant changes
            if len(orig_line.strip()) > 5 or len(fmt_line.strip()) > 5:
                print(f"Line {i+1}:")
                print(f"  - {orig_line[:70]}{'...' if len(orig_line) > 70 else ''}")
                print(f"  + {fmt_line[:70]}{'...' if len(fmt_line) > 70 else ''}")
                differences += 1
    
    if differences == 0:
        print("No major structural differences found")

async def main():
    """Main function to test formatting on critical Heart Rush sections."""
    
    # Initialize OpenAI client
    try:
        client = get_openai_client()
    except ValueError as e:
        print(f"❌ Error: {e}")
        print("💡 Make sure your .env file contains: OPENAI_API_KEY=your_key_here")
        return
    
    sections_dir = "sections"
    output_dir = "sections_test_formatted"
    
    print("🧪 Starting Heart Rush Critical Sections Test Formatting")
    print(f"📁 Input directory: {sections_dir}")
    print(f"📁 Output directory: {output_dir}")
    print(f"🎯 Critical sections to process: {len(CRITICAL_SECTIONS)}")
    
    try:
        # Get critical section files
        print("\n📋 Loading critical section files...")
        test_files = get_critical_section_files(sections_dir)
        
        if not test_files:
            print("❌ No suitable section files found")
            return
        
        print(f"📄 Found {len(test_files)} critical sections:")
        for file_path, size in test_files:
            print(f"  • {file_path.name} ({size:,} chars)")
        
        print(f"\n🚀 Processing all {len(test_files)} sections in parallel...")
        
        # Process all sections in parallel
        async def process_section(file_info):
            file_path, original_size = file_info
            try:
                # Read original content
                with open(file_path, 'r', encoding='utf-8') as f:
                    original_content = f.read()
                
                # Format with OpenAI
                formatted_content, tokens_used = await format_section_with_openai(
                    client, file_path, original_content
                )
                
                if formatted_content:
                    # Save formatted file
                    output_path = save_formatted_section(
                        file_path, formatted_content, output_dir
                    )
                    
                    # Compare files
                    compare_sections(file_path, output_path)
                    
                    return True, tokens_used, original_size
                else:
                    return False, 0, original_size
                    
            except Exception as e:
                print(f"❌ Error processing {file_path}: {e}")
                return False, 0, original_size
        
        # Run all sections in parallel
        tasks = [process_section(file_info) for file_info in test_files]
        results = await asyncio.gather(*tasks)
        
        # Calculate totals
        total_tokens = 0
        total_chars = 0
        successful_files = 0
        
        for success, tokens_used, original_size in results:
            total_chars += original_size
            if success:
                successful_files += 1
                total_tokens += tokens_used
        
        # Final summary
        print(f"\n{'='*60}")
        print(f"CRITICAL SECTIONS FORMATTING TEST COMPLETE")
        print(f"{'='*60}")
        print(f"✅ Successfully processed: {successful_files}/{len(test_files)} sections")
        print(f"📄 Total content processed: {total_chars:,} characters")
        print(f"🎯 Total tokens used: {total_tokens:,}")
        
        # Calculate cost with GPT-4o-mini pricing
        # Input: $0.15 per million tokens = $0.00000015 per token
        # Output: $0.60 per million tokens = $0.0000006 per token
        input_cost_per_token = 0.00000015
        output_cost_per_token = 0.0000006
        # Using average since we don't track separately
        avg_cost_per_token = (input_cost_per_token + output_cost_per_token) / 2
        estimated_cost = total_tokens * avg_cost_per_token
        print(f"💰 Estimated cost: ${estimated_cost:.4f} (GPT-4o-mini pricing)")
        print(f"📁 Test results saved to: {output_dir}")
        
        if successful_files > 0:
            print(f"\n💡 Review the results in {output_dir} to see formatting improvements!")
            print(f"💡 These are the most critical sections for Heart Rush gameplay.")
            print(f"💡 If satisfied, you can process additional sections or run full formatting.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())