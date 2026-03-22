"""
Gemini client factory
=====================
Creates a fresh client per request to avoid
"client has been closed" errors in long-running FastAPI servers.
"""

import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

def get_client() -> genai.Client:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY not set in environment")
    return genai.Client(api_key=key)
