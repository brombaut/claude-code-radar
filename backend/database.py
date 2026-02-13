import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "events.db"

def init_db():
    """Initialize database with schema."""
    with sqlite3.connect(DB_PATH) as conn:
        # Enable WAL mode for better concurrency
        conn.execute("PRAGMA journal_mode=WAL")

        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                session_id TEXT NOT NULL,
                hook_event_type TEXT NOT NULL,
                source_app TEXT,
                model_name TEXT,
                tool_name TEXT,
                payload TEXT,
                summary TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hook_event_type ON events(hook_event_type)")

        conn.commit()

@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()