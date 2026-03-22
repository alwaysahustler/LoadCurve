"""
SQL Agent — two-shot pattern with token tracking
Cost controls:
- gemini-2.5-flash-preview-05-20
- schema under 120 tokens
- results capped at 10 rows
- daily token limit enforced
- stateless, no chat history
"""

import os
import re
import psycopg2
import psycopg2.extras
from google import genai
from dotenv import load_dotenv

from agent.schema import SCHEMA
from agent.safety import is_safe_sql
from agent.token_tracker import log_usage, is_daily_limit_reached
from agent.question_guard import validate as validate_question

load_dotenv()

MODEL        = "gemini-2.5-flash-preview-05-20"

def _get_client():
    """Lazy init — only fails at call time, not import time."""
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY not set in environment")
    return genai.Client(api_key=key)
DATABASE_URL = os.getenv("DATABASE_URL")
MAX_ROWS     = 10

# cumulative token counter for this request
_req_input  = 0
_req_output = 0


def clean_sql(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"^```sql\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"^```\s*",    "", raw)
    raw = re.sub(r"\s*```$",    "", raw)
    return raw.strip()


def run_sql(sql: str) -> list[dict]:
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    cur  = conn.cursor()
    cur.execute(sql)
    rows = cur.fetchmany(MAX_ROWS)
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def format_rows(rows: list[dict]) -> str:
    if not rows:
        return "No results found."
    return "\n".join(
        ", ".join(f"{k}={v}" for k, v in row.items())
        for row in rows
    )


def ask_gemini(prompt: str) -> tuple[str, int, int]:
    """Returns (text, input_tokens, output_tokens)."""
    response = _get_client().models.generate_content(model=MODEL, contents=prompt)
    usage    = response.usage_metadata
    return (
        response.text.strip(),
        usage.prompt_token_count     or 0,
        usage.candidates_token_count or 0,
    )


def ask(question: str) -> dict:
    # Question guard — blocks off-topic and malicious questions
    allowed, reason = validate_question(question)
    if not allowed:
        return {
            "answer": None, "sql": None, "rows": [],
            "error": reason,
            "tokens_used": 0,
        }

    # Daily limit check
    if is_daily_limit_reached():
        return {
            "answer": None, "sql": None, "rows": [],
            "error": "Daily token limit reached. Try again tomorrow.",
            "tokens_used": 0,
        }

    total_input = total_output = 0

    # ── Shot 1: question → SQL ────────────────────────────────────────────────
    sql_prompt = (
        f"Schema:\n{SCHEMA}\n"
        f"Write a PostgreSQL SELECT query to answer: {question}\n"
        f"Rules: return ONLY the SQL, no markdown, no explanation, "
        f"always aggregate or limit to {MAX_ROWS} rows max."
    )

    try:
        sql_raw, i1, o1 = ask_gemini(sql_prompt)
        total_input += i1; total_output += o1
        sql = clean_sql(sql_raw)
    except Exception as e:
        return {"answer": None, "sql": None, "rows": [], "error": f"Gemini error (shot 1): {e}", "tokens_used": 0}

    # Safety check
    if not is_safe_sql(sql):
        return {"answer": None, "sql": sql, "rows": [], "error": f"Unsafe SQL blocked.", "tokens_used": total_input + total_output}

    # Run SQL
    try:
        rows = run_sql(sql)
    except Exception as e:
        return {"answer": None, "sql": sql, "rows": [], "error": f"SQL error: {e}", "tokens_used": total_input + total_output}

    # ── Shot 2: results → answer ──────────────────────────────────────────────
    answer_prompt = (
        f"Question: {question}\n"
        f"SQL result:\n{format_rows(rows)}\n"
        f"Answer in 1-2 sentences with specific numbers."
    )

    try:
        answer, i2, o2 = ask_gemini(answer_prompt)
        total_input += i2; total_output += o2
    except Exception as e:
        return {"answer": None, "sql": sql, "rows": rows, "error": f"Gemini error (shot 2): {e}", "tokens_used": total_input + total_output}

    # Log usage
    try:
        log_usage(question, total_input, total_output)
    except Exception:
        pass  # never fail the response because of logging

    return {
        "answer":     answer,
        "sql":        sql,
        "rows":       rows,
        "error":      None,
        "tokens_used": total_input + total_output,
    }