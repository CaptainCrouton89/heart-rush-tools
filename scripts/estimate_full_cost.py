#!/usr/bin/env python3
"""
Cost Estimation Script for Heart Rush Rules Processing
Estimates token usage and cost for processing all files in data/ directory.
"""

import tiktoken
from pathlib import Path


def estimate_tokens(text, model="gpt-4"):
    """Estimate token count for given text using tiktoken."""
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except Exception:
        # Fallback: rough estimate of 4 chars per token
        return len(text) // 4


def get_all_markdown_files(data_dir):
    """Get all markdown files from data directory."""
    data_path = Path(data_dir)
    if not data_path.exists():
        raise FileNotFoundError(f"Data directory {data_path} not found")
    
    return list(data_path.rglob("*.md"))


def analyze_file_content(file_path):
    """Analyze a single file and return content stats."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        char_count = len(content)
        word_count = len(content.split())
        line_count = len(content.split('\n'))
        
        # Estimate input tokens (original content)
        input_tokens = estimate_tokens(content)
        
        # Estimate output tokens (formatted content - assume similar length)
        # In practice, formatting might add/remove some content
        output_tokens = int(input_tokens * 1.1)  # Assume 10% increase
        
        return {
            'file_path': file_path,
            'char_count': char_count,
            'word_count': word_count,
            'line_count': line_count,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'total_tokens': input_tokens + output_tokens
        }
        
    except Exception as e:
        print(f"❌ Error reading {file_path}: {e}")
        return None


def main():
    """Main function to estimate costs for all files."""
    
    data_dir = "data"
    
    print("💰 Heart Rush Rules - Full Cost Estimation")
    print(f"📁 Analyzing directory: {data_dir}")
    print("=" * 60)
    
    try:
        # Get all markdown files
        md_files = get_all_markdown_files(data_dir)
        
        if not md_files:
            print("❌ No markdown files found")
            return
        
        print(f"📄 Found {len(md_files)} markdown files")
        print("\n🔍 Analyzing files...")
        
        # Analyze all files
        total_files = 0
        total_chars = 0
        total_words = 0
        total_lines = 0
        total_input_tokens = 0
        total_output_tokens = 0
        total_tokens = 0
        
        file_stats = []
        
        for file_path in md_files:
            stats = analyze_file_content(file_path)
            if stats:
                file_stats.append(stats)
                total_files += 1
                total_chars += stats['char_count']
                total_words += stats['word_count']
                total_lines += stats['line_count']
                total_input_tokens += stats['input_tokens']
                total_output_tokens += stats['output_tokens']
                total_tokens += stats['total_tokens']
        
        # Sort by token count for analysis
        file_stats.sort(key=lambda x: x['total_tokens'], reverse=True)
        
        # Show top 10 largest files
        print("\n📊 TOP 10 LARGEST FILES (by token count):")
        print("-" * 80)
        for i, stats in enumerate(file_stats[:10]):
            rel_path = stats['file_path'].relative_to(Path(data_dir))
            print(f"{i+1:2d}. {rel_path}")
            print(f"    📏 {stats['char_count']:,} chars, {stats['word_count']:,} words, {stats['total_tokens']:,} tokens")
        
        # Calculate costs
        print(f"\n{'='*60}")
        print("FULL DATASET ANALYSIS")
        print(f"{'='*60}")
        print(f"📄 Total files: {total_files:,}")
        print(f"📝 Total characters: {total_chars:,}")
        print(f"📝 Total words: {total_words:,}")
        print(f"📝 Total lines: {total_lines:,}")
        print(f"🎯 Total input tokens: {total_input_tokens:,}")
        print(f"🎯 Total output tokens: {total_output_tokens:,}")
        print(f"🎯 Total tokens: {total_tokens:,}")
        
        # Cost calculations with correct pricing
        input_cost = total_input_tokens * 0.00000005  # $0.05 per million
        output_cost = total_output_tokens * 0.0000002  # $0.20 per million
        total_cost = input_cost + output_cost
        
        print(f"\n💰 COST BREAKDOWN:")
        print(f"💰 Input tokens cost:  ${input_cost:.4f}")
        print(f"💰 Output tokens cost: ${output_cost:.4f}")
        print(f"💰 Total estimated cost: ${total_cost:.4f}")
        print(f"💰 (at $0.05/M input, $0.20/M output tokens)")
        
        # Additional insights
        avg_tokens_per_file = total_tokens / total_files if total_files > 0 else 0
        print(f"\n📊 INSIGHTS:")
        print(f"📊 Average tokens per file: {avg_tokens_per_file:,.0f}")
        print(f"📊 Largest file: {file_stats[0]['total_tokens']:,} tokens")
        print(f"📊 Smallest file: {file_stats[-1]['total_tokens']:,} tokens")
        
        # Show distribution
        small_files = sum(1 for s in file_stats if s['total_tokens'] < 1000)
        medium_files = sum(1 for s in file_stats if 1000 <= s['total_tokens'] < 5000)
        large_files = sum(1 for s in file_stats if s['total_tokens'] >= 5000)
        
        print(f"📊 File size distribution:")
        print(f"    Small (<1K tokens):  {small_files:3d} files")
        print(f"    Medium (1K-5K):      {medium_files:3d} files")
        print(f"    Large (>5K tokens):  {large_files:3d} files")
        
        print(f"\n💡 This estimate assumes formatting will produce similar-length output.")
        print(f"💡 Actual costs may vary based on OpenAI API response lengths.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()