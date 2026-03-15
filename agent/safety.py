import re

def is_safe_sql(sql: str) -> bool:
    """
    Check if the SQL query is safe to execute.
    Only allows SELECT statements, blocks destructive keywords.
    Semicolons are allowed only at the very end (not in the middle).
    """
    cleaned = sql.strip().upper()

    # Only allow SELECT statements
    if not cleaned.startswith("SELECT"):
        return False

    # Disallow destructive keywords
    banned = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "EXEC", "TRUNCATE"]
    for keyword in banned:
        # use word boundary so e.g. "CREATED_AT" column doesn't match "CREATE"
        if re.search(rf"\b{keyword}\b", cleaned):
            return False

    # Block UNION (used for injection)
    if re.search(r"\bUNION\b", cleaned):
        return False

    # Block semicolons in the MIDDLE of the query (multiple statements)
    # A trailing semicolon is fine — strip it and check for more
    stripped = cleaned.rstrip(";").strip()
    if ";" in stripped:
        return False

    return True