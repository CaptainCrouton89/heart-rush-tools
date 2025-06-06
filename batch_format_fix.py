#!/usr/bin/env python3
"""
OpenAI Batch API Script for Heart Rush Rules Formatting
Uses OpenAI's Batch API to process all split markdown files with GPT-4.1-nano
to fix formatting issues and improve markdown structure.
"""

import json
import os
import time
from pathlib import Path

import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_batch_requests(data_dir):
    """Create batch requests for all markdown files in the data directory."""
    
    data_path = Path(data_dir)
    if not data_path.exists():
        raise FileNotFoundError(f"Data directory {data_path} not found")
    
    # Find all markdown files
    md_files = list(data_path.rglob("*.md"))
    print(f"📁 Found {len(md_files)} markdown files to process")
    
    batch_requests = []
    
    for i, file_path in enumerate(md_files):
        # Read file content
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"❌ Error reading {file_path}: {e}")
            continue
        
        # Skip very small files (likely empty or just headers)
        if len(content.strip()) < 50:
            print(f"⏭️  Skipping small file: {file_path}")
            continue
        
        # Create relative path for identification
        relative_path = file_path.relative_to(data_path)
        
        # Create batch request
        request = {
            "custom_id": f"format_fix_{i}_{str(relative_path).replace('/', '_').replace('.md', '')}",
            "method": "POST",
            "url": "/v1/chat/completions",
            "body": {
                "model": "gpt-4.1-nano",
                "messages": [
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

Return the corrected markdown content with improved formatting."""
                    },
                    {
                        "role": "user",
                        "content": f"Please fix the formatting issues in this Heart Rush rules section:\n\n```markdown\n{content}\n```"
                    }
                ],
                "temperature": 0.1
            }
        }
        
        batch_requests.append(request)
    
    return batch_requests, [str(f.relative_to(data_path)) for f in md_files if len(open(f, 'r', encoding='utf-8').read().strip()) >= 50]

def create_batch_file(requests, output_file):
    """Create the JSONL batch file for OpenAI."""
    
    with open(output_file, 'w', encoding='utf-8') as f:
        for request in requests:
            f.write(json.dumps(request) + '\n')
    
    print(f"📄 Created batch file: {output_file}")
    print(f"📊 Total requests: {len(requests)}")

def upload_batch(client, batch_file_path):
    """Upload the batch file to OpenAI."""
    
    print("📤 Uploading batch file to OpenAI...")
    
    with open(batch_file_path, 'rb') as f:
        batch_input_file = client.files.create(
            file=f,
            purpose="batch"
        )
    
    print(f"✅ Batch file uploaded: {batch_input_file.id}")
    
    # Create the batch
    batch = client.batches.create(
        input_file_id=batch_input_file.id,
        endpoint="/v1/chat/completions",
        completion_window="24h",
        metadata={
            "description": "Heart Rush rules formatting fixes"
        }
    )
    
    print(f"🚀 Batch created: {batch.id}")
    print(f"📊 Status: {batch.status}")
    
    return batch

def check_batch_status(client, batch_id):
    """Check the status of a batch job."""
    
    batch = client.batches.retrieve(batch_id)
    
    print(f"\n📊 BATCH STATUS UPDATE")
    print(f"Batch ID: {batch.id}")
    print(f"Status: {batch.status}")
    print(f"Created at: {batch.created_at}")
    
    if hasattr(batch, 'request_counts'):
        counts = batch.request_counts
        print(f"Total requests: {counts.total}")
        print(f"Completed: {counts.completed}")
        print(f"Failed: {counts.failed}")
    
    if batch.status == "completed":
        print(f"✅ Batch completed!")
        if batch.output_file_id:
            print(f"Output file ID: {batch.output_file_id}")
    elif batch.status == "failed":
        print(f"❌ Batch failed!")
        if hasattr(batch, 'errors'):
            print(f"Errors: {batch.errors}")
    elif batch.status in ["validating", "in_progress"]:
        print(f"⏳ Batch is still processing...")
    
    return batch

def download_results(client, batch, output_dir):
    """Download and process the batch results."""
    
    if batch.status != "completed" or not batch.output_file_id:
        print("❌ Batch not completed or no output file available")
        return
    
    print("📥 Downloading batch results...")
    
    # Download the results file
    file_response = client.files.content(batch.output_file_id)
    results_content = file_response.content.decode('utf-8')
    
    # Parse results
    results = []
    for line in results_content.strip().split('\n'):
        if line:
            results.append(json.loads(line))
    
    print(f"📊 Processing {len(results)} results...")
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    success_count = 0
    error_count = 0
    
    for result in results:
        custom_id = result['custom_id']
        
        if result.get('error'):
            print(f"❌ Error in {custom_id}: {result['error']}")
            error_count += 1
            continue
        
        if 'response' not in result or 'body' not in result['response']:
            print(f"❌ Invalid response format for {custom_id}")
            error_count += 1
            continue
        
        response_body = result['response']['body']
        
        if 'choices' not in response_body or not response_body['choices']:
            print(f"❌ No choices in response for {custom_id}")
            error_count += 1
            continue
        
        # Extract the formatted content
        formatted_content = response_body['choices'][0]['message']['content']
        
        # Remove markdown code block wrapper if present
        if formatted_content.startswith('```markdown\n'):
            formatted_content = formatted_content[12:]
        if formatted_content.endswith('\n```'):
            formatted_content = formatted_content[:-4]
        
        # Determine output file path from custom_id
        # custom_id format: format_fix_{i}_{relative_path_modified}
        parts = custom_id.split('_', 3)
        if len(parts) >= 4:
            path_part = parts[3].replace('_', '/')
            # Handle the file path reconstruction
            if not path_part.endswith('.md'):
                path_part += '.md'
            
            output_file_path = output_path / path_part
            output_file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write the formatted content
            with open(output_file_path, 'w', encoding='utf-8') as f:
                f.write(formatted_content)
            
            print(f"✅ Saved: {output_file_path}")
            success_count += 1
        else:
            print(f"❌ Could not parse file path from custom_id: {custom_id}")
            error_count += 1
    
    print(f"\n📊 RESULTS SUMMARY")
    print(f"✅ Successfully processed: {success_count}")
    print(f"❌ Errors: {error_count}")
    print(f"📁 Output directory: {output_path}")

def main():
    """Main function to orchestrate the batch processing."""
    
    # Check for API key
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in environment variables")
        print("💡 Make sure your .env file contains: OPENAI_API_KEY=your_key_here")
        return
    
    # Initialize OpenAI client
    client = openai.OpenAI(api_key=api_key)
    
    data_dir = "data"
    batch_file = "heart_rush_batch_requests.jsonl"
    output_dir = "data_formatted"
    
    print("🚀 Starting Heart Rush Rules Batch Formatting")
    print(f"📁 Input directory: {data_dir}")
    print(f"📁 Output directory: {output_dir}")
    
    try:
        # Create batch requests
        print("\n📋 Creating batch requests...")
        requests, file_paths = create_batch_requests(data_dir)
        
        if not requests:
            print("❌ No valid files found to process")
            return
        
        # Create batch file
        create_batch_file(requests, batch_file)
        
        # Upload and start batch
        batch = upload_batch(client, batch_file)
        
        print(f"\n🎯 BATCH SUBMITTED SUCCESSFULLY!")
        print(f"Batch ID: {batch.id}")
        print(f"Status: {batch.status}")
        print(f"\n💡 To check status later, run:")
        print(f"    python batch_format_fix.py --check {batch.id}")
        print(f"\n💡 To download results when complete, run:")
        print(f"    python batch_format_fix.py --download {batch.id}")
        
        # Save batch ID for later reference
        with open("batch_info.json", 'w') as f:
            json.dump({
                "batch_id": batch.id,
                "created_at": time.time(),
                "file_count": len(requests),
                "output_dir": output_dir
            }, f, indent=2)
        
        print(f"📄 Batch info saved to: batch_info.json")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

def check_status_command(batch_id):
    """Check status of a specific batch."""
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in environment variables")
        return
    
    client = openai.OpenAI(api_key=api_key)
    check_batch_status(client, batch_id)

def download_command(batch_id):
    """Download results for a specific batch."""
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in environment variables")
        return
    
    client = openai.OpenAI(api_key=api_key)
    batch = client.batches.retrieve(batch_id)
    
    # Load output directory from batch info if available
    output_dir = "data_formatted"
    try:
        with open("batch_info.json", 'r') as f:
            batch_info = json.load(f)
            if batch_info.get('batch_id') == batch_id:
                output_dir = batch_info.get('output_dir', output_dir)
    except FileNotFoundError:
        pass
    
    download_results(client, batch, output_dir)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) == 3 and sys.argv[1] == "--check":
        check_status_command(sys.argv[2])
    elif len(sys.argv) == 3 and sys.argv[1] == "--download":
        download_command(sys.argv[2])
    else:
        main()