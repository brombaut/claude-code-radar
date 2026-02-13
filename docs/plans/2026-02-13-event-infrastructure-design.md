# Event Infrastructure Design

**Date:** 2026-02-13
**Status:** Approved
**Goal:** Build real-time monitoring dashboard to watch Claude Code sessions live

## Overview

Build infrastructure to consume events from Claude Code hooks, persist them to a database, and display them in a real-time monitoring dashboard with multiple views.

## Requirements

- Real-time monitoring dashboard for Claude Code sessions
- Persist events to lightweight database
- Multiple views:
  - Session overview (active sessions, models, context window usage)
  - Tool usage analytics (which tools, success/failure rates)
  - Event stream (live feed of all events)
- Prioritize ease of development and iteration

## Technology Stack

- **Backend:** FastAPI (Python)
- **Database:** SQLite
- **Real-time:** Server-Sent Events (SSE)
- **Frontend:** React + Vite
- **Language:** Python (backend), TypeScript/JavaScript (frontend)

### Why This Stack

- **FastAPI:** Excellent async support, native SSE, auto-generated API docs
- **SQLite:** Zero-config file-based database, perfect for "light database" requirement
- **SSE:** Simpler than WebSockets for one-way streaming (server→browser)
- **React + Vite:** Rich component ecosystem with fast build tooling
- **Separation:** Backend and frontend separate for flexibility, but still simple to run

## Architecture

### Project Structure

```
claude-code-observability/
├── backend/
│   ├── main.py              # FastAPI app, SSE endpoint, event receiver
│   ├── database.py          # SQLite connection and models
│   ├── events.py            # Event storage and querying logic
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main app with routing
│   │   ├── components/      # React components for each view
│   │   ├── hooks/           # Custom hooks for SSE connection
│   │   └── api/             # API client functions
│   ├── package.json
│   └── vite.config.ts
└── docs/
    └── plans/
        └── 2026-02-13-event-infrastructure-design.md
```

### Component Architecture

**Backend (FastAPI)** - Single Python server with three responsibilities:
1. `/events` POST endpoint - receives events from Claude Code hooks
2. `/api/*` REST endpoints - serves historical data to frontend
3. `/stream` SSE endpoint - streams new events in real-time to connected clients

**Database (SQLite)** - Single `events.db` file with tables:
- `events` table with all events and common fields
- Indexed by session_id, event_type, and timestamp

**Frontend (React + Vite)** - Single-page app with three main views:
1. Session Overview - grid of active sessions
2. Tool Analytics - charts and stats
3. Event Stream - real-time scrolling log

### Communication Flow

```
Claude Code hooks → POST /events → SQLite + SSE broadcast
Browser → REST /api/* → Query SQLite → JSON response
Browser ← SSE /stream ← Real-time events
```

## Components

### Backend Components

1. **Event Receiver (main.py - POST /events)**
   - Accepts JSON events from hooks
   - Validates event structure
   - Stores to SQLite via events.py
   - Broadcasts to all connected SSE clients
   - Returns 200 OK immediately (non-blocking)

2. **Event Storage (events.py)**
   - `save_event()` - insert event into database
   - `get_events()` - query events with filters (session_id, event_type, time range)
   - `get_active_sessions()` - find sessions with recent activity
   - `get_tool_stats()` - aggregate tool usage data

3. **Database Schema (database.py)**
   - Single `events` table:
     - `id` (primary key)
     - `timestamp` (indexed)
     - `session_id` (indexed)
     - `hook_event_type` (indexed)
     - `source_app`
     - `model_name`
     - `tool_name` (nullable)
     - `payload` (JSON blob for event-specific data)
     - `summary` (nullable, AI-generated summary)

4. **SSE Stream (main.py - GET /stream)**
   - Maintains list of connected clients
   - When event received, broadcast to all clients
   - Auto-cleanup disconnected clients

### Frontend Components

1. **SSE Hook (useEventStream.ts)**
   - Custom React hook connecting to /stream
   - Maintains EventSource connection
   - Provides events to components
   - Auto-reconnect on disconnect

2. **Session Overview (SessionOverview.tsx)**
   - Grid/list of active sessions
   - Shows: session_id, model, context usage, last activity
   - Fetches from `/api/sessions/active`
   - Updates in real-time from SSE

3. **Tool Analytics (ToolAnalytics.tsx)**
   - Charts showing tool usage (bar/pie charts)
   - Success vs failure rates
   - Fetches from `/api/tools/stats`
   - Time range selector (last hour, day, week)

4. **Event Stream (EventStream.tsx)**
   - Scrolling log of events
   - Color-coded by event type
   - Expandable rows to see full payload
   - Auto-scroll toggle
   - Filter by event type, session

## Data Flow

### Scenario 1: New Event Arrives

```
Claude Code hook
  → POST /events with JSON payload
  → FastAPI validates & extracts fields
  → Save to SQLite events table
  → Broadcast to all SSE clients as JSON
  → Return 200 OK to hook
  → Frontend components receive event via SSE
  → Update UI (add to stream, update stats, refresh sessions)
```

### Scenario 2: User Opens Dashboard

```
Browser loads React app
  → App establishes SSE connection to /stream
  → Each view component fetches initial data:
     - SessionOverview → GET /api/sessions/active
     - ToolAnalytics → GET /api/tools/stats?range=1h
     - EventStream → GET /api/events?limit=100
  → Render with historical data
  → Listen for new events via SSE
  → Incrementally update views as events arrive
```

### Scenario 3: User Filters Event Stream

```
User selects filter (e.g., "only PreToolUse events")
  → Update local state
  → Re-fetch: GET /api/events?event_type=PreToolUse&limit=100
  → Continue receiving all events via SSE
  → Filter in frontend before displaying
```

### Key Design Decisions

- **Write path:** Events written once to SQLite, broadcasted once to SSE clients
- **Read path:** Initial load from SQLite, updates from SSE (no polling needed)
- **SSE sends full event:** Frontend doesn't need to re-query database for new events
- **Filters apply to both:** Historical queries AND real-time stream filtering

## Error Handling

### Backend Error Handling

1. **Invalid Event Data**
   - Validate required fields (session_id, hook_event_type, timestamp)
   - Return 400 Bad Request with error details
   - Log error but don't crash server
   - Hook will continue (exits 0 regardless)

2. **Database Errors**
   - Wrap all DB operations in try/except
   - If save fails, log error and return 500
   - Event still broadcasts to SSE clients
   - SQLite auto-recovery for corruption

3. **SSE Client Disconnects**
   - Detect broken connections via write failures
   - Remove from active clients list
   - Client auto-reconnects via EventSource built-in retry

4. **Server Restart**
   - SSE clients detect disconnect, auto-reconnect
   - Frontend shows "reconnecting..." indicator
   - On reconnect, fetch recent events to fill gap

### Frontend Error Handling

1. **SSE Connection Failure**
   - EventSource automatically retries with exponential backoff
   - Show connection status indicator (connected/reconnecting/error)
   - Fallback: If SSE fails repeatedly, poll `/api/events` every 5 seconds

2. **API Request Failures**
   - Wrap fetch calls in try/catch
   - Show error toast/message to user
   - Retry button for failed requests

3. **Malformed Event Data**
   - Validate event structure before rendering
   - Log warning and skip rendering bad events
   - Don't crash the whole view

### Graceful Degradation

- If SSE not supported (old browsers), fall back to polling
- If database query slow, show loading spinner
- If no events yet, show empty state with helpful message

## Testing

### Testing Strategy

Keeping testing lightweight for ease of development:

**Backend Testing:**
1. Manual testing via FastAPI auto-generated `/docs` endpoint
2. Integration test script that simulates hook behavior
3. Optional unit tests for events.py functions (if needed later)

**Frontend Testing:**
1. Manual browser testing
2. Mock event generator button in UI for testing real-time updates

**Deployment Testing:**
- Smoke test checklist:
  - Backend starts without errors
  - Database file created
  - Frontend builds successfully
  - Can POST event and see it in UI
  - SSE connection stays alive

**No CI/CD initially** - focus on iteration speed

## Implementation Notes

- Start with minimal viable version of each component
- Use FastAPI `/docs` for API exploration during development
- Keep frontend components simple initially, enhance later
- SQLite file will be in backend directory (gitignored)
- CORS configuration needed for frontend to call backend APIs during development

## Success Criteria

1. Claude Code hooks successfully send events to backend
2. Events persist to SQLite database
3. Dashboard shows real-time events as they arrive
4. Can view active sessions with current state
5. Can see tool usage statistics
6. Can filter and search event stream
7. System runs reliably without crashes
8. Easy to start/stop for development
