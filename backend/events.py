import json
import time
from typing import Optional
from database import get_db

def save_event(
    timestamp: int,
    session_id: str,
    hook_event_type: str,
    source_app: Optional[str] = None,
    model_name: Optional[str] = None,
    tool_name: Optional[str] = None,
    payload: Optional[dict] = None,
    summary: Optional[str] = None
) -> int:
    """Save event to database. Returns event ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO events (
                timestamp, session_id, hook_event_type,
                source_app, model_name, tool_name, payload, summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            timestamp,
            session_id,
            hook_event_type,
            source_app,
            model_name,
            tool_name,
            json.dumps(payload) if payload else None,
            summary
        ))
        conn.commit()
        return cursor.lastrowid

def get_events(
    limit: int = 100,
    session_id: Optional[str] = None,
    event_type: Optional[str] = None
) -> list[dict]:
    """Query events with optional filters."""
    with get_db() as conn:
        query = "SELECT * FROM events WHERE 1=1"
        params = []

        if session_id:
            query += " AND session_id = ?"
            params.append(session_id)

        if event_type:
            query += " AND hook_event_type = ?"
            params.append(event_type)

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        cursor = conn.cursor()
        cursor.execute(query, params)

        events = []
        for row in cursor.fetchall():
            event = dict(row)
            if event['payload']:
                event['payload'] = json.loads(event['payload'])
            events.append(event)

        return events

def get_active_sessions(minutes: int = 60) -> list[dict]:
    """Get sessions with activity in last N minutes."""
    with get_db() as conn:
        # Calculate cutoff timestamp (current time - minutes)
        cutoff = int((time.time() - minutes * 60) * 1000)

        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                e.session_id,
                (SELECT model_name FROM events
                 WHERE session_id = e.session_id
                 ORDER BY timestamp DESC LIMIT 1) as model_name,
                MAX(e.timestamp) as last_activity,
                COUNT(*) as event_count
            FROM events e
            WHERE e.timestamp > ?
            GROUP BY e.session_id
            ORDER BY last_activity DESC
        """, (cutoff,))

        sessions = []
        for row in cursor.fetchall():
            sessions.append(dict(row))

        return sessions

def get_tool_stats(hours: int = 1) -> dict:
    """Get tool usage statistics for last N hours."""
    with get_db() as conn:
        cutoff = int((time.time() - hours * 3600) * 1000)

        cursor = conn.cursor()

        # Tool usage counts
        cursor.execute("""
            SELECT
                tool_name,
                COUNT(*) as count
            FROM events
            WHERE timestamp > ? AND tool_name IS NOT NULL
            GROUP BY tool_name
            ORDER BY count DESC
        """, (cutoff,))

        tool_usage = [dict(row) for row in cursor.fetchall()]

        # Success vs failure for PostToolUse vs PostToolUseFailure
        cursor.execute("""
            SELECT
                CASE
                    WHEN hook_event_type = 'PostToolUseFailure' THEN 'failure'
                    ELSE 'success'
                END as status,
                COUNT(*) as count
            FROM events
            WHERE timestamp > ?
                AND (hook_event_type = 'PostToolUse' OR hook_event_type = 'PostToolUseFailure')
            GROUP BY status
        """, (cutoff,))

        success_failure = {row['status']: row['count'] for row in cursor.fetchall()}

        return {
            "tool_usage": tool_usage,
            "success_failure": success_failure
        }