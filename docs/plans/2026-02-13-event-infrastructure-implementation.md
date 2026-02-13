# Event Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build real-time monitoring dashboard with FastAPI backend, SQLite database, SSE streaming, and React frontend to watch Claude Code sessions live.

**Architecture:** FastAPI receives events via POST, stores in SQLite, broadcasts via SSE to React frontend with three views (Session Overview, Tool Analytics, Event Stream).

**Tech Stack:** Python 3.11+, FastAPI, SQLite, React 18+, Vite, TypeScript

---

## Task 1: Backend Project Setup

**Files:**
- Create: `backend/main.py`
- Create: `backend/requirements.txt`
- Create: `backend/.gitignore`

**Step 1: Create backend directory structure**

```bash
mkdir -p backend
cd backend
```

**Step 2: Create requirements.txt**

```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-dotenv==1.0.0
```

**Step 3: Create .gitignore**

```txt
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.env
*.db
*.sqlite
*.sqlite3
.DS_Store
```

**Step 4: Create minimal FastAPI app**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Claude Code Observability API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Claude Code Observability API"}

@app.get("/health")
def health():
    return {"status": "healthy"}
```

**Step 5: Test server starts**

Run: `cd backend && uvicorn main:app --reload`
Expected: Server starts on http://127.0.0.1:8000
Visit: http://127.0.0.1:8000/docs
Expected: Swagger UI loads

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: initialize FastAPI backend with CORS"
```

---

## Task 2: Database Schema

**Files:**
- Create: `backend/database.py`

**Step 1: Create database.py with SQLite connection**

```python
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "events.db"

def init_db():
    """Initialize database with schema."""
    conn = sqlite3.connect(DB_PATH)
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
    conn.close()

@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
```

**Step 2: Add database initialization to main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db

app = FastAPI(title="Claude Code Observability API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def root():
    return {"message": "Claude Code Observability API"}

@app.get("/health")
def health():
    return {"status": "healthy"}
```

**Step 3: Test database creation**

Run: `cd backend && uvicorn main:app --reload`
Expected: `events.db` file created in backend/ directory
Run: `sqlite3 events.db ".schema"`
Expected: Shows events table and indexes

**Step 4: Commit**

```bash
git add backend/database.py backend/main.py
git commit -m "feat: add SQLite database schema with indexes"
```

---

## Task 3: Event Storage Logic

**Files:**
- Create: `backend/events.py`

**Step 1: Create events.py with save_event function**

```python
import json
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
        import time
        cutoff = int((time.time() - minutes * 60) * 1000)

        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                session_id,
                model_name,
                MAX(timestamp) as last_activity,
                COUNT(*) as event_count
            FROM events
            WHERE timestamp > ?
            GROUP BY session_id, model_name
            ORDER BY last_activity DESC
        """, (cutoff,))

        sessions = []
        for row in cursor.fetchall():
            sessions.append(dict(row))

        return sessions

def get_tool_stats(hours: int = 1) -> dict:
    """Get tool usage statistics for last N hours."""
    with get_db() as conn:
        import time
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
```

**Step 2: Test event storage manually**

Run Python REPL:
```python
from events import save_event, get_events
import time

event_id = save_event(
    timestamp=int(time.time() * 1000),
    session_id="test-session",
    hook_event_type="PreToolUse",
    source_app="test",
    model_name="claude-sonnet-4-5",
    tool_name="Read",
    payload={"file_path": "/test/file.py"}
)
print(f"Saved event ID: {event_id}")

events = get_events(limit=10)
print(f"Found {len(events)} events")
print(events[0])
```

Expected: Event saved and retrieved successfully

**Step 3: Commit**

```bash
git add backend/events.py
git commit -m "feat: add event storage and query functions"
```

---

## Task 4: Event Receiver Endpoint

**Files:**
- Modify: `backend/main.py`

**Step 1: Add POST /events endpoint**

Add to `backend/main.py`:

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from database import init_db
from events import save_event
import asyncio

app = FastAPI(title="Claude Code Observability API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SSE clients list (will be used for broadcasting)
sse_clients = []

class Event(BaseModel):
    timestamp: int
    session_id: str
    hook_event_type: str
    source_app: Optional[str] = None
    model_name: Optional[str] = None
    tool_name: Optional[str] = None
    payload: Optional[dict] = None
    summary: Optional[str] = None

@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def root():
    return {"message": "Claude Code Observability API"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/events")
async def receive_event(event: Event):
    """Receive event from Claude Code hooks."""
    try:
        # Save to database
        event_id = save_event(
            timestamp=event.timestamp,
            session_id=event.session_id,
            hook_event_type=event.hook_event_type,
            source_app=event.source_app,
            model_name=event.model_name,
            tool_name=event.tool_name,
            payload=event.payload,
            summary=event.summary
        )

        # Broadcast to SSE clients
        event_data = event.model_dump()
        event_data['id'] = event_id

        for queue in sse_clients:
            await queue.put(event_data)

        return {"status": "ok", "event_id": event_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 2: Test POST /events via curl**

Run server: `uvicorn main:app --reload`

Run curl:
```bash
curl -X POST http://localhost:8000/events \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": 1707000000000,
    "session_id": "test-123",
    "hook_event_type": "PreToolUse",
    "source_app": "claude-code-observability",
    "model_name": "claude-sonnet-4-5",
    "tool_name": "Read",
    "payload": {"file_path": "/test.py"}
  }'
```

Expected: `{"status":"ok","event_id":1}`

Verify in database:
```bash
sqlite3 events.db "SELECT * FROM events"
```

**Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add POST /events endpoint with validation"
```

---

## Task 5: API Endpoints for Frontend

**Files:**
- Modify: `backend/main.py`

**Step 1: Add GET /api/events endpoint**

Add to `backend/main.py`:

```python
from events import save_event, get_events, get_active_sessions, get_tool_stats

# ... existing code ...

@app.get("/api/events")
def list_events(
    limit: int = 100,
    session_id: Optional[str] = None,
    event_type: Optional[str] = None
):
    """Get events with optional filters."""
    events = get_events(limit=limit, session_id=session_id, event_type=event_type)
    return {"events": events, "count": len(events)}

@app.get("/api/sessions/active")
def active_sessions(minutes: int = 60):
    """Get active sessions from last N minutes."""
    sessions = get_active_sessions(minutes=minutes)
    return {"sessions": sessions, "count": len(sessions)}

@app.get("/api/tools/stats")
def tool_statistics(hours: int = 1):
    """Get tool usage statistics."""
    stats = get_tool_stats(hours=hours)
    return stats
```

**Step 2: Test API endpoints**

Run server and test via curl:

```bash
# Test events endpoint
curl http://localhost:8000/api/events?limit=10

# Test active sessions
curl http://localhost:8000/api/sessions/active?minutes=60

# Test tool stats
curl http://localhost:8000/api/tools/stats?hours=1
```

Expected: JSON responses with data

Visit: http://localhost:8000/docs
Expected: New endpoints visible in Swagger UI

**Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add API endpoints for events, sessions, and stats"
```

---

## Task 6: SSE Streaming Endpoint

**Files:**
- Modify: `backend/main.py`

**Step 1: Add SSE /stream endpoint**

Add to `backend/main.py`:

```python
from fastapi.responses import StreamingResponse
import json

# ... existing code ...

async def event_generator():
    """Generate SSE events for connected clients."""
    queue = asyncio.Queue()
    sse_clients.append(queue)

    try:
        while True:
            event_data = await queue.get()
            yield f"data: {json.dumps(event_data)}\n\n"
    except asyncio.CancelledError:
        sse_clients.remove(queue)

@app.get("/stream")
async def stream_events():
    """SSE endpoint for real-time event streaming."""
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

**Step 2: Test SSE endpoint**

Run server: `uvicorn main:app --reload`

In one terminal, connect to SSE:
```bash
curl -N http://localhost:8000/stream
```

In another terminal, send an event:
```bash
curl -X POST http://localhost:8000/events \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": 1707000000000,
    "session_id": "sse-test",
    "hook_event_type": "UserPromptSubmit",
    "model_name": "claude-sonnet-4-5"
  }'
```

Expected: First terminal shows `data: {"timestamp":...}` event

**Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add SSE streaming endpoint for real-time events"
```

---

## Task 7: Frontend Project Setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

**Step 1: Initialize frontend directory**

```bash
cd ..
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 2: Configure Vite for API proxy**

Edit `frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/stream': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

**Step 3: Create minimal App.tsx**

Edit `frontend/src/App.tsx`:

```typescript
function App() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Claude Code Observability</h1>
      <p>Dashboard loading...</p>
    </div>
  )
}

export default App
```

**Step 4: Test frontend starts**

Run: `npm run dev`
Expected: Server starts on http://localhost:5173
Visit: http://localhost:5173
Expected: Page shows "Claude Code Observability"

**Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: initialize React frontend with Vite and TypeScript"
```

---

## Task 8: SSE Hook for Real-Time Events

**Files:**
- Create: `frontend/src/hooks/useEventStream.ts`

**Step 1: Create useEventStream hook**

```typescript
import { useEffect, useState, useRef } from 'react'

export interface ClaudeEvent {
  id: number
  timestamp: number
  session_id: string
  hook_event_type: string
  source_app?: string
  model_name?: string
  tool_name?: string
  payload?: any
  summary?: string
}

export function useEventStream() {
  const [events, setEvents] = useState<ClaudeEvent[]>([])
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const eventSource = new EventSource('/stream')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setConnected(true)
      console.log('SSE connected')
    }

    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data) as ClaudeEvent
      setEvents(prev => [event, ...prev])
    }

    eventSource.onerror = () => {
      setConnected(false)
      console.error('SSE connection error')
    }

    return () => {
      eventSource.close()
      setConnected(false)
    }
  }, [])

  return { events, connected }
}
```

**Step 2: Test hook in App.tsx**

Edit `frontend/src/App.tsx`:

```typescript
import { useEventStream } from './hooks/useEventStream'

function App() {
  const { events, connected } = useEventStream()

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Claude Code Observability</h1>
      <p>Connection: {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      <p>Events received: {events.length}</p>
      <pre>{JSON.stringify(events.slice(0, 3), null, 2)}</pre>
    </div>
  )
}

export default App
```

**Step 3: Test SSE connection**

Run backend: `cd backend && uvicorn main:app --reload`
Run frontend: `cd frontend && npm run dev`
Visit: http://localhost:5173

Send test event:
```bash
curl -X POST http://localhost:8000/events \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": 1707000000000,
    "session_id": "frontend-test",
    "hook_event_type": "PreToolUse",
    "model_name": "claude-sonnet-4-5"
  }'
```

Expected: Frontend shows "Connected" and displays the event

**Step 4: Commit**

```bash
git add frontend/src/hooks/useEventStream.ts frontend/src/App.tsx
git commit -m "feat: add SSE hook for real-time event streaming"
```

---

## Task 9: Event Stream Component

**Files:**
- Create: `frontend/src/components/EventStream.tsx`

**Step 1: Create EventStream component**

```typescript
import { useState, useEffect } from 'react'
import { ClaudeEvent } from '../hooks/useEventStream'

interface EventStreamProps {
  events: ClaudeEvent[]
}

export function EventStream({ events }: EventStreamProps) {
  const [filter, setFilter] = useState<string>('')
  const [autoScroll, setAutoScroll] = useState(true)

  const filteredEvents = filter
    ? events.filter(e => e.hook_event_type === filter)
    : events

  const eventTypes = [...new Set(events.map(e => e.hook_event_type))]

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <h2>Event Stream</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All Events</option>
          {eventTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
      </div>

      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '0.875rem'
      }}>
        {filteredEvents.length === 0 && (
          <p style={{ color: '#666' }}>No events yet. Waiting for activity...</p>
        )}
        {filteredEvents.map((event, idx) => (
          <div
            key={`${event.id}-${idx}`}
            style={{
              padding: '0.5rem',
              borderBottom: '1px solid #eee',
              backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white'
            }}
          >
            <div style={{ fontWeight: 'bold', color: getEventColor(event.hook_event_type) }}>
              {event.hook_event_type}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              Session: {event.session_id.slice(0, 8)}... |
              Time: {new Date(event.timestamp).toLocaleTimeString()}
              {event.tool_name && ` | Tool: ${event.tool_name}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getEventColor(eventType: string): string {
  const colors: Record<string, string> = {
    'PreToolUse': '#0066cc',
    'PostToolUse': '#00aa00',
    'PostToolUseFailure': '#cc0000',
    'SessionStart': '#6600cc',
    'SessionEnd': '#cc6600',
    'UserPromptSubmit': '#00cccc',
  }
  return colors[eventType] || '#333'
}
```

**Step 2: Add EventStream to App**

Edit `frontend/src/App.tsx`:

```typescript
import { useEventStream } from './hooks/useEventStream'
import { EventStream } from './components/EventStream'

function App() {
  const { events, connected } = useEventStream()

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Claude Code Observability</h1>
        <p>Connection: {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      </header>

      <EventStream events={events} />
    </div>
  )
}

export default App
```

**Step 3: Test event stream**

Run both servers and send multiple events with different types
Expected: Events appear in real-time, color-coded by type, filterable

**Step 4: Commit**

```bash
git add frontend/src/components/EventStream.tsx frontend/src/App.tsx
git commit -m "feat: add EventStream component with filtering"
```

---

## Task 10: Session Overview Component

**Files:**
- Create: `frontend/src/components/SessionOverview.tsx`
- Create: `frontend/src/api/client.ts`

**Step 1: Create API client**

```typescript
export interface Session {
  session_id: string
  model_name: string
  last_activity: number
  event_count: number
}

export async function fetchActiveSessions(minutes: number = 60): Promise<Session[]> {
  const response = await fetch(`/api/sessions/active?minutes=${minutes}`)
  const data = await response.json()
  return data.sessions
}

export async function fetchEvents(params: {
  limit?: number
  session_id?: string
  event_type?: string
} = {}) {
  const query = new URLSearchParams()
  if (params.limit) query.set('limit', params.limit.toString())
  if (params.session_id) query.set('session_id', params.session_id)
  if (params.event_type) query.set('event_type', params.event_type)

  const response = await fetch(`/api/events?${query}`)
  const data = await response.json()
  return data.events
}
```

**Step 2: Create SessionOverview component**

```typescript
import { useState, useEffect } from 'react'
import { Session, fetchActiveSessions } from '../api/client'
import { ClaudeEvent } from '../hooks/useEventStream'

interface SessionOverviewProps {
  events: ClaudeEvent[]
}

export function SessionOverview({ events }: SessionOverviewProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  // Update sessions when new events arrive
  useEffect(() => {
    if (events.length > 0) {
      loadSessions()
    }
  }, [events.length])

  async function loadSessions() {
    setLoading(true)
    try {
      const data = await fetchActiveSessions(60)
      setSessions(data)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading sessions...</div>
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
      <h2>Active Sessions (Last 60 min)</h2>

      {sessions.length === 0 && (
        <p style={{ color: '#666' }}>No active sessions</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {sessions.map(session => (
          <div
            key={session.session_id}
            style={{
              border: '1px solid #ddd',
              padding: '1rem',
              borderRadius: '4px',
              backgroundColor: '#f9f9f9'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {session.session_id.slice(0, 12)}...
            </div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              <div>Model: {session.model_name || 'Unknown'}</div>
              <div>Events: {session.event_count}</div>
              <div>Last: {new Date(session.last_activity).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Add to App**

Edit `frontend/src/App.tsx`:

```typescript
import { useEventStream } from './hooks/useEventStream'
import { EventStream } from './components/EventStream'
import { SessionOverview } from './components/SessionOverview'

function App() {
  const { events, connected } = useEventStream()

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Claude Code Observability</h1>
        <p>Connection: {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      </header>

      <SessionOverview events={events} />
      <EventStream events={events} />
    </div>
  )
}

export default App
```

**Step 4: Test session overview**

Send events from different sessions
Expected: SessionOverview shows multiple sessions with stats

**Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/components/SessionOverview.tsx frontend/src/App.tsx
git commit -m "feat: add SessionOverview component with API client"
```

---

## Task 11: Tool Analytics Component

**Files:**
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/components/ToolAnalytics.tsx`

**Step 1: Add tool stats to API client**

Add to `frontend/src/api/client.ts`:

```typescript
export interface ToolStats {
  tool_usage: Array<{ tool_name: string; count: number }>
  success_failure: { success?: number; failure?: number }
}

export async function fetchToolStats(hours: number = 1): Promise<ToolStats> {
  const response = await fetch(`/api/tools/stats?hours=${hours}`)
  return response.json()
}
```

**Step 2: Create ToolAnalytics component**

```typescript
import { useState, useEffect } from 'react'
import { ToolStats, fetchToolStats } from '../api/client'
import { ClaudeEvent } from '../hooks/useEventStream'

interface ToolAnalyticsProps {
  events: ClaudeEvent[]
}

export function ToolAnalytics({ events }: ToolAnalyticsProps) {
  const [stats, setStats] = useState<ToolStats | null>(null)
  const [timeRange, setTimeRange] = useState(1)

  useEffect(() => {
    loadStats()
  }, [timeRange])

  useEffect(() => {
    if (events.length > 0) {
      loadStats()
    }
  }, [events.length])

  async function loadStats() {
    try {
      const data = await fetchToolStats(timeRange)
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  if (!stats) {
    return <div>Loading stats...</div>
  }

  const totalSuccess = stats.success_failure.success || 0
  const totalFailure = stats.success_failure.failure || 0
  const total = totalSuccess + totalFailure
  const successRate = total > 0 ? ((totalSuccess / total) * 100).toFixed(1) : '0'

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <h2>Tool Analytics</h2>
        <select value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))}>
          <option value={1}>Last Hour</option>
          <option value={24}>Last 24 Hours</option>
          <option value={168}>Last Week</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Tool Usage */}
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Tool Usage</h3>
          {stats.tool_usage.length === 0 ? (
            <p style={{ color: '#666' }}>No tool usage data</p>
          ) : (
            <div>
              {stats.tool_usage.map(tool => (
                <div
                  key={tool.tool_name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem',
                    borderBottom: '1px solid #eee'
                  }}
                >
                  <span>{tool.tool_name}</span>
                  <span style={{ fontWeight: 'bold' }}>{tool.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Success vs Failure */}
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Success Rate</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00aa00' }}>
            {successRate}%
          </div>
          <div style={{ marginTop: '1rem' }}>
            <div style={{ color: '#00aa00' }}>✓ Success: {totalSuccess}</div>
            <div style={{ color: '#cc0000' }}>✗ Failure: {totalFailure}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Add to App**

Edit `frontend/src/App.tsx`:

```typescript
import { useEventStream } from './hooks/useEventStream'
import { EventStream } from './components/EventStream'
import { SessionOverview } from './components/SessionOverview'
import { ToolAnalytics } from './components/ToolAnalytics'

function App() {
  const { events, connected } = useEventStream()

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Claude Code Observability</h1>
        <p>Connection: {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      </header>

      <SessionOverview events={events} />
      <ToolAnalytics events={events} />
      <EventStream events={events} />
    </div>
  )
}

export default App
```

**Step 4: Test tool analytics**

Send various tool events (PreToolUse, PostToolUse, PostToolUseFailure)
Expected: ToolAnalytics shows tool usage and success/failure rates

**Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/components/ToolAnalytics.tsx frontend/src/App.tsx
git commit -m "feat: add ToolAnalytics component with success rates"
```

---

## Task 12: Integration Test Script

**Files:**
- Create: `backend/test_events.py`

**Step 1: Create test script**

```python
#!/usr/bin/env python3
"""
Send test events to the observability server.
Usage: python test_events.py
"""

import requests
import time
import random

BASE_URL = "http://localhost:8000"

def send_event(event_data):
    """Send an event to the server."""
    response = requests.post(f"{BASE_URL}/events", json=event_data)
    print(f"Sent {event_data['hook_event_type']}: {response.status_code}")
    return response

def generate_test_events():
    """Generate a sequence of realistic test events."""
    session_id = f"test-session-{int(time.time())}"

    events = [
        # Session start
        {
            "timestamp": int(time.time() * 1000),
            "session_id": session_id,
            "hook_event_type": "SessionStart",
            "source_app": "claude-code-observability",
            "model_name": "claude-sonnet-4-5"
        },

        # User prompt
        {
            "timestamp": int(time.time() * 1000) + 100,
            "session_id": session_id,
            "hook_event_type": "UserPromptSubmit",
            "model_name": "claude-sonnet-4-5",
            "payload": {"prompt": "Create a README file"}
        },

        # Tool uses
        {
            "timestamp": int(time.time() * 1000) + 200,
            "session_id": session_id,
            "hook_event_type": "PreToolUse",
            "model_name": "claude-sonnet-4-5",
            "tool_name": "Read",
            "payload": {"file_path": "/home/user/project/README.md"}
        },
        {
            "timestamp": int(time.time() * 1000) + 300,
            "session_id": session_id,
            "hook_event_type": "PostToolUse",
            "model_name": "claude-sonnet-4-5",
            "tool_name": "Read"
        },
        {
            "timestamp": int(time.time() * 1000) + 400,
            "session_id": session_id,
            "hook_event_type": "PreToolUse",
            "model_name": "claude-sonnet-4-5",
            "tool_name": "Write",
            "payload": {"file_path": "/home/user/project/README.md"}
        },
        {
            "timestamp": int(time.time() * 1000) + 500,
            "session_id": session_id,
            "hook_event_type": "PostToolUse",
            "model_name": "claude-sonnet-4-5",
            "tool_name": "Write"
        },
    ]

    return events

if __name__ == "__main__":
    print("Sending test events to observability server...")
    print(f"Target: {BASE_URL}")

    # Check server is running
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"✓ Server is healthy: {response.json()}")
    except requests.ConnectionError:
        print("✗ Server is not running. Start it with: uvicorn main:app --reload")
        exit(1)

    # Send events
    events = generate_test_events()
    for event in events:
        send_event(event)
        time.sleep(0.5)  # Small delay between events

    print(f"\n✓ Sent {len(events)} test events")
    print(f"View them at: http://localhost:5173")
```

**Step 2: Make executable and test**

```bash
chmod +x backend/test_events.py
pip install requests
python backend/test_events.py
```

Expected: Events sent successfully, visible in frontend

**Step 3: Commit**

```bash
git add backend/test_events.py
git commit -m "feat: add integration test script for event generation"
```

---

## Task 13: Documentation and README Updates

**Files:**
- Modify: `README.md`

**Step 1: Update README with usage instructions**

Add to existing README.md:

```markdown

## Running the Dashboard

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs on: http://localhost:8000
API docs: http://localhost:8000/docs

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: http://localhost:5173

### Testing

Send test events:
```bash
cd backend
python test_events.py
```

### Usage

1. Start backend server
2. Start frontend dev server
3. Open http://localhost:5173
4. Claude Code hooks will send events automatically
5. Dashboard updates in real-time

### Dashboard Views

- **Session Overview**: Active sessions from last 60 minutes
- **Tool Analytics**: Tool usage stats and success rates
- **Event Stream**: Real-time event log with filtering

### API Endpoints

- `POST /events` - Receive events from hooks
- `GET /api/events` - Query historical events
- `GET /api/sessions/active` - Get active sessions
- `GET /api/tools/stats` - Tool usage statistics
- `GET /stream` - SSE endpoint for real-time streaming
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add dashboard setup and usage instructions"
```

---

## Task 14: Final Integration Test

**Step 1: Smoke test checklist**

1. Backend starts: `cd backend && uvicorn main:app --reload`
   - Expected: Server starts on http://127.0.0.1:8000
   - Check: http://localhost:8000/health returns `{"status":"healthy"}`

2. Database created: `ls backend/events.db`
   - Expected: File exists

3. Frontend builds: `cd frontend && npm run dev`
   - Expected: Server starts on http://localhost:5173

4. Can POST event: `python backend/test_events.py`
   - Expected: Events sent successfully

5. Events visible in UI: Visit http://localhost:5173
   - Expected: Events appear in Event Stream
   - Expected: Sessions appear in Session Overview
   - Expected: Tool stats appear in Tool Analytics

6. SSE stays alive: Keep frontend open
   - Expected: Connection status shows "🟢 Connected"
   - Send more events with test script
   - Expected: New events appear immediately

**Step 2: Document any issues found**

If any issues found during smoke test, fix them and document in commit message.

**Step 3: Final commit**

```bash
git add -A
git commit -m "test: verify end-to-end integration

- Backend starts without errors
- Database created successfully
- Frontend builds and serves
- Events POST successfully
- Real-time updates working via SSE
- All three dashboard views functional"
```

---

## Execution Complete

All tasks completed. The event infrastructure is now ready for use.

**To run the system:**

1. Terminal 1: `cd backend && uvicorn main:app --reload`
2. Terminal 2: `cd frontend && npm run dev`
3. Visit: http://localhost:5173

**Next steps:**

- Configure Claude Code hooks to send to http://localhost:8000/events
- Monitor dashboard for real-time activity
- Iterate on UI/UX improvements as needed
