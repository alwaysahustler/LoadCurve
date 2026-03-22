"""
Gemini client — thread-safe, no connection reuse issues.
Creates a new client per call using only the API key.
The google-genai SDK manages its own connection pool per client instance.
"""

import os
from dotenv import load_dotenv

load_dotenv()

def call_gemini(model: str, prompt: str) -> tuple[str, int, int]:
    """
    Make a single Gemini API call.
    Returns (text, input_tokens, output_tokens).
    Imports and creates client fresh each call — avoids closed client errors.
    """
    from google import genai  # local import avoids module-level client state

    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY not set")

    client   = genai.Client(api_key=key)
    response = client.models.generate_content(model=model, contents=prompt)
    usage    = response.usage_metadata

    return (
        response.text.strip(),
        usage.prompt_token_count     or 0,
        usage.candidates_token_count or 0,
    )