#!/usr/bin/env python3
"""
Shared OpenAI configuration for Heart Rush formatting scripts.
Contains common model settings, prompts, and utility functions.
"""

import os
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Model configuration
MODEL_NAME = "gpt-4.1-nano"
TEMPERATURE = 0.1

# Common system prompt for formatting
SYSTEM_PROMPT = """You are a markdown formatting expert. Your task is to fix formatting issues in this Heart Rush TTRPG rules document section.

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

def get_openai_client():
    """Get configured OpenAI client."""
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    
    return openai.OpenAI(api_key=api_key)

def create_format_messages(content):
    """Create messages for formatting request."""
    return [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": f"Please fix the formatting issues in this Heart Rush rules section:\n\n{content}"
        }
    ]

def create_completion_params(content):
    """Create completion parameters for OpenAI API."""
    return {
        "model": MODEL_NAME,
        "messages": create_format_messages(content),
        "temperature": TEMPERATURE
    }

def create_batch_request_body(content):
    """Create batch request body for OpenAI Batch API."""
    return {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT.replace("Return ONLY the corrected markdown content with improved formatting. Do not wrap in code blocks or add explanations.", "Return the corrected markdown content with improved formatting.")
            },
            {
                "role": "user", 
                "content": f"Please fix the formatting issues in this Heart Rush rules section:\n\n```markdown\n{content}\n```"
            }
        ],
        "temperature": TEMPERATURE
    }