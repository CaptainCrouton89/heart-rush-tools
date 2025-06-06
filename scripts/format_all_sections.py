#!/usr/bin/env python3
"""
Format All Heart Rush Sections Script
Processes all markdown files in heart_rush/all_sections/ with gpt-4.1-nano to add back styling.
"""

import asyncio
from pathlib import Path

from openai_config import create_completion_params, get_openai_client

async def format_section_with_openai(client, file_path, content):
    """Format a single section file using OpenAI API to add back styling."""
    
    print(f"🤖 Processing: {file_path.name}")
    print(f"📏 Content length: {len(content)} characters")
    
    # Create conservative prompt for adding minimal structural formatting
    enhanced_prompt = f"""This is a section from a Heart Rush TTRPG rulebook that has lost its basic markdown structure. Please add ONLY minimal formatting:

1. **Headers**: Add markdown headers (# ## ###) for clear section breaks - look for natural topic divisions
2. **Lists**: Convert obvious lists to bullet points or numbered lists 
3. **Paragraphs**: Add proper paragraph breaks where sentences clearly form separate thoughts
4. **Line breaks**: Remove excessive blank lines

IMPORTANT: Do NOT add bold text, italics, or emphasis to individual words within paragraphs. Keep the text clean and readable like a professional rule document. Only add structural formatting, not decorative styling.

Keep ALL the original text content exactly the same - only add basic structure.

{content}"""
    
    try:
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model="gpt-4.1-nano",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a technical document formatter. Add only minimal structural markdown formatting to TTRPG rules. Do NOT add bold, italics, or emphasis within paragraphs. Only add headers, lists, and paragraph breaks for clear document structure."
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

def get_all_section_files(sections_dir):
    """Get all markdown files from the all_sections directory."""
    
    sections_path = Path(sections_dir)
    if not sections_path.exists():
        raise FileNotFoundError(f"Sections directory {sections_path} not found")
    
    # Find all .md files
    md_files = list(sections_path.glob("*.md"))
    
    valid_files = []
    for file_path in md_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if len(content.strip()) > 50:  # Skip empty/tiny files
                valid_files.append((file_path, len(content)))
            else:
                print(f"⚠️  Skipping {file_path.name} (too small: {len(content)} chars)")
        except Exception as e:
            print(f"⚠️  Error reading {file_path.name}: {e}")
    
    return valid_files

async def main():
    """Main function to format all Heart Rush sections."""
    
    # Initialize OpenAI client
    try:
        client = get_openai_client()
    except ValueError as e:
        print(f"❌ Error: {e}")
        print("💡 Make sure your .env file contains: OPENAI_API_KEY=your_key_here")
        return
    
    sections_dir = "heart_rush/all_sections"
    output_dir = "heart_rush/all_sections_formatted"
    
    print("🎨 Starting Heart Rush All Sections Formatting")
    print(f"📁 Input directory: {sections_dir}")
    print(f"📁 Output directory: {output_dir}")
    
    try:
        # Get all section files
        print("\n📋 Loading all section files...")
        section_files = get_all_section_files(sections_dir)
        
        if not section_files:
            print("❌ No suitable section files found")
            return
        
        print(f"📄 Found {len(section_files)} sections:")
        for file_path, size in section_files:
            print(f"  • {file_path.name} ({size:,} chars)")
        
        print(f"\n🚀 Processing all {len(section_files)} sections in parallel...")
        
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
                    
                    return True, tokens_used, original_size, file_path.name
                else:
                    return False, 0, original_size, file_path.name
                    
            except Exception as e:
                print(f"❌ Error processing {file_path}: {e}")
                return False, 0, original_size, file_path.name
        
        # Run all sections in parallel
        tasks = [process_section(file_info) for file_info in section_files]
        results = await asyncio.gather(*tasks)
        
        # Calculate totals
        total_tokens = 0
        total_chars = 0
        successful_files = 0
        failed_files = []
        
        for success, tokens_used, original_size, filename in results:
            total_chars += original_size
            if success:
                successful_files += 1
                total_tokens += tokens_used
            else:
                failed_files.append(filename)
        
        # Final summary
        print(f"\n{'='*60}")
        print(f"ALL SECTIONS FORMATTING COMPLETE")
        print(f"{'='*60}")
        print(f"✅ Successfully processed: {successful_files}/{len(section_files)} sections")
        print(f"📄 Total content processed: {total_chars:,} characters")
        print(f"🎯 Total tokens used: {total_tokens:,}")
        
        if failed_files:
            print(f"❌ Failed files: {', '.join(failed_files)}")
        
        # Calculate cost with gpt-4.1-nano pricing (assuming similar to gpt-4o-mini)
        # Using gpt-4o-mini pricing as approximation
        input_cost_per_token = 0.00000015
        output_cost_per_token = 0.0000006
        avg_cost_per_token = (input_cost_per_token + output_cost_per_token) / 2
        estimated_cost = total_tokens * avg_cost_per_token
        print(f"💰 Estimated cost: ${estimated_cost:.4f}")
        print(f"📁 Formatted files saved to: {output_dir}")
        
        if successful_files > 0:
            print(f"\n💡 All Heart Rush sections have been formatted with proper styling!")
            print(f"💡 Check {output_dir} to see the results with headers, bold text, lists, etc.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())