"""
Agent API endpoints
POST /ask          — ask a question
GET  /token-stats  — token usage and cost
"""

from fastapi import APIRouter
from pydantic import BaseModel
from agent.sql_agent import ask
from agent.token_tracker import get_stats, setup_token_table

router = APIRouter()

# create token_usage table on startup if not exists
try:
    setup_token_table()
except Exception:
    pass


class Question(BaseModel):
    question: str


@router.post("/ask")
def ask_agent(body: Question):
    if not body.question.strip():
        return {"answer": None, "sql": None, "rows": [], "error": "Empty question", "tokens_used": 0}
    return ask(body.question.strip())


@router.get("/token-stats")
def token_stats():
    return get_stats()