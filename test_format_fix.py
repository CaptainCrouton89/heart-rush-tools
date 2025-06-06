#!/usr/bin/env python3
"""
Test Script for Heart Rush Rules Formatting
Processes a few files directly with OpenAI API to test formatting fixes.
"""

import asyncio
import os
import time
from pathlib import Path

import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_test_files(data_dir, max_files=3):
    """Get a small sample of files for testing."""
    
    data_path = Path(data_dir)
    if not data_path.exists():
        raise FileNotFoundError(f"Data directory {data_path} not found")
    
    # Find all markdown files
    md_files = list(data_path.rglob("*.md"))
    
    # Filter out very small files and select diverse samples
    good_files = []
    for file_path in md_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Skip very small files or index
            if len(content.strip()) < 100 or 'index.md' in str(file_path):
                continue
                
            good_files.append((file_path, len(content)))
        except Exception as e:
            continue
    
    # Sort by size and pick diverse samples
    good_files.sort(key=lambda x: x[1])
    
    # Pick small, medium, and large files
    test_files = []
    if good_files:
        # Small file
        test_files.append(good_files[0][0])
        
        # Medium file
        if len(good_files) > 1:
            mid_idx = len(good_files) // 2
            test_files.append(good_files[mid_idx][0])
        
        # Large file
        if len(good_files) > 2:
            test_files.append(good_files[-1][0])
    
    # Limit to max_files
    return test_files[:max_files]

async def format_file_with_openai(client, file_path, content):
    """Format a single file using OpenAI API."""
    
    print(f"🤖 Processing: {file_path}")
    print(f"📏 Content length: {len(content)} characters")
    
    try:
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model="gpt-4.1-nano",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a markdown formatting expert. Your task is to fix formatting issues in this Heart Rush TTRPG rules document section.

SPECIFIC TASKS:
1. Fix malformed headers (ensure proper # spacing)
2. Fix broken lists (ensure proper bullet spacing)
3. Fix code block formatting (ensure ``` are on their own lines)
4. Remove excessive blank lines (max 2 consecutive)
5. Remove unnecessary line breaks
6. Fix emphasis markers (**bold** and *italic*) spacing
7. Fix any broken links or references
8. Ensure consistent indentation
9. Fix any character encoding issues
10. Maintain the exact same content - only fix formatting, don't change wording

IMPORTANT RULES:
- Keep ALL original content intact
- Only fix formatting and structure
- Preserve the meaning and intent
- Keep all game mechanics exactly as written
- Don't add or remove any substantive content
- Fix obvious typos only if they're clearly formatting-related

Return ONLY the corrected markdown content with improved formatting. Do not wrap in code blocks or add explanations."""
                    },
                    {
                        "role": "user",
                        "content": f"Please fix the formatting issues in this Heart Rush rules section:\n\n{content}"
                    }
                ],
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

def save_formatted_file(original_path, formatted_content, output_dir):
    """Save the formatted content to output directory."""
    
    # Create relative path structure
    data_path = Path("data")
    relative_path = original_path.relative_to(data_path)
    
    output_path = Path(output_dir) / relative_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save formatted content
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(formatted_content)
    
    print(f"💾 Saved to: {output_path}")
    return output_path

def compare_files(original_path, formatted_path):
    """Compare original and formatted files to show changes."""
    
    with open(original_path, 'r', encoding='utf-8') as f:
        original = f.read()
    
    with open(formatted_path, 'r', encoding='utf-8') as f:
        formatted = f.read()
    
    # Basic comparison stats
    orig_lines = len(original.split('\n'))
    fmt_lines = len(formatted.split('\n'))
    orig_chars = len(original)
    fmt_chars = len(formatted)
    
    print(f"\n📊 COMPARISON FOR {original_path.name}")
    print(f"Original:  {orig_lines:4d} lines, {orig_chars:5d} chars")
    print(f"Formatted: {fmt_lines:4d} lines, {fmt_chars:5d} chars")
    print(f"Change:    {fmt_lines-orig_lines:+4d} lines, {fmt_chars-orig_chars:+5d} chars")
    
    # Show first few differences (simplified)
    orig_lines_list = original.split('\n')
    fmt_lines_list = formatted.split('\n')
    
    differences = 0
    for i, (orig_line, fmt_line) in enumerate(zip(orig_lines_list, fmt_lines_list)):
        if orig_line != fmt_line and differences < 3:
            print(f"Line {i+1}:")
            print(f"  - {orig_line[:60]}{'...' if len(orig_line) > 60 else ''}")
            print(f"  + {fmt_line[:60]}{'...' if len(fmt_line) > 60 else ''}")
            differences += 1
    
    if differences == 0:
        print("No line-by-line differences found (formatting may be identical)")

async def main():
    """Main function to test formatting on a few files."""
    
    # Check for API key
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in environment variables")
        print("💡 Make sure your .env file contains: OPENAI_API_KEY=your_key_here")
        return
    
    # Initialize OpenAI client
    client = openai.OpenAI(api_key=api_key)
    
    data_dir = "data"
    output_dir = "data_test_formatted"
    
    print("🧪 Starting Heart Rush Rules Test Formatting")
    print(f"📁 Input directory: {data_dir}")
    print(f"📁 Output directory: {output_dir}")
    
    try:
        # Get test files
        print("\n📋 Selecting test files...")
        test_files = get_test_files(data_dir, max_files=3)
        
        if not test_files:
            print("❌ No suitable test files found")
            return
        
        print(f"📄 Selected {len(test_files)} files for testing:")
        for file_path in test_files:
            print(f"  • {file_path.relative_to(Path(data_dir))}")
        
        print(f"\n🚀 Processing all {len(test_files)} files in parallel...")
        
        # Process all files in parallel
        async def process_file(file_path):
            try:
                # Read original content
                with open(file_path, 'r', encoding='utf-8') as f:
                    original_content = f.read()
                
                # Format with OpenAI
                formatted_content, tokens_used = await format_file_with_openai(
                    client, file_path, original_content
                )
                
                if formatted_content:
                    # Save formatted file
                    output_path = save_formatted_file(
                        file_path, formatted_content, output_dir
                    )
                    
                    # Compare files
                    compare_files(file_path, output_path)
                    
                    return True, tokens_used
                else:
                    return False, 0
                    
            except Exception as e:
                print(f"❌ Error processing {file_path}: {e}")
                return False, 0
        
        # Run all files in parallel
        tasks = [process_file(file_path) for file_path in test_files]
        results = await asyncio.gather(*tasks)
        
        # Calculate totals
        total_tokens = 0
        successful_files = 0
        
        for success, tokens_used in results:
            if success:
                successful_files += 1
                total_tokens += tokens_used
        
        # Final summary
        print(f"\n{'='*60}")
        print(f"TEST FORMATTING COMPLETE")
        print(f"{'='*60}")
        print(f"✅ Successfully processed: {successful_files}/{len(test_files)} files")
        print(f"🎯 Total tokens used: {total_tokens:,}")
        print(f"💰 Estimated cost: ${total_tokens * 0.00015:.4f} (at $0.15/1K tokens)")
        print(f"📁 Test results saved to: {output_dir}")
        
        if successful_files > 0:
            print(f"\n💡 Review the results in {output_dir} to see if the formatting looks good!")
            print(f"💡 If satisfied, you can run the full batch processing script.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())