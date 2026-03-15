"""
Token Tracker
=============
Stores cumulative token usage in Neon.
Creates a simple token_usage table if it doesn't exist.

Gemini 2.5 Flash pricing (as of 2025):
  Input:  $0.15  per 1M tokens
  Output: $0.60  per 1M tokens
"""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

INPUT_COST_PER_M  = 0.15   # $ per 1M input tokens
OUTPUT_COST_PER_M = 0.60   # $ per 1M output tokens
DAILY_TOKEN_LIMIT = 50_000  # hard cap ~$0.04/day — change as you like


def setup_token_table():
    """Create token_usage table if not exists. Call once on startup."""
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS token_usage (
            id           SERIAL PRIMARY KEY,
            ts           TIMESTAMPTZ DEFAULT NOW(),
            question     TEXT,
            input_tokens  INTEGER,
            output_tokens INTEGER,
            total_tokens  INTEGER
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


def log_usage(question: str, input_tokens: int, output_tokens: int):
    """Insert one row per agent call."""
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()
    cur.execute(
        """
        INSERT INTO token_usage (question, input_tokens, output_tokens, total_tokens)
        VALUES (%s, %s, %s, %s)
        """,
        (question, input_tokens, output_tokens, input_tokens + output_tokens)
    )
    conn.commit()
    cur.close()
    conn.close()


def get_stats() -> dict:
    """Return total tokens used, cost, and today's usage."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    cur  = conn.cursor()

    cur.execute("""
        SELECT
            COALESCE(SUM(input_tokens),  0) AS total_input,
            COALESCE(SUM(output_tokens), 0) AS total_output,
            COALESCE(SUM(total_tokens),  0) AS total_all,
            COALESCE(SUM(CASE WHEN ts::date = CURRENT_DATE THEN total_tokens ELSE 0 END), 0) AS today_tokens,
            COUNT(*) AS total_calls
        FROM token_usage
    """)
    row = dict(cur.fetchone())
    cur.close()
    conn.close()

    total_input  = row["total_input"]
    total_output = row["total_output"]
    total_cost   = (total_input / 1_000_000 * INPUT_COST_PER_M) + \
                   (total_output / 1_000_000 * OUTPUT_COST_PER_M)

    # how many tokens until $1
    # $1 = X tokens — using blended rate (assume 70% input, 30% output)
    blended_cost_per_token = (0.7 * INPUT_COST_PER_M + 0.3 * OUTPUT_COST_PER_M) / 1_000_000
    tokens_per_dollar = int(1 / blended_cost_per_token)
    tokens_until_dollar = max(0, tokens_per_dollar - row["total_all"])

    return {
        "total_tokens":        row["total_all"],
        "today_tokens":        row["today_tokens"],
        "total_calls":         row["total_calls"],
        "total_cost_usd":      round(total_cost, 6),
        "tokens_until_dollar": tokens_until_dollar,
        "daily_limit":         DAILY_TOKEN_LIMIT,
        "daily_remaining":     max(0, DAILY_TOKEN_LIMIT - row["today_tokens"]),
        "daily_limit_reached": row["today_tokens"] >= DAILY_TOKEN_LIMIT,
    }


def is_daily_limit_reached() -> bool:
    stats = get_stats()
    return stats["daily_limit_reached"]
