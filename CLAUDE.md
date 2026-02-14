# Claude Code Radar (CCR)

*"I see a bad moon rising, I see trouble on the way"* 🎵

## Project Overview

Claude Code Radar is a real-time monitoring and logging system for Claude Code sessions. It captures every event during a Claude Code session—tool calls, prompts, errors, subagent activity, context compaction—and provides a web dashboard for visualization and analysis.

## Architecture

The system has three main components:

### 1. Hooks (`.claude/hooks/`)
Python scripts that execute in response to Claude Code events. Each hook:
- Logs events to JSON files in `logs/`
- Sends events to the backend HTTP server at `http://localhost:8000/events`
- Uses `uv` inline script declarations for dependency management
- **Critical**: Hook scripts must be fast (<100ms) to avoid slowing down Claude Code

**Key hooks:**
- `session_start.py` - Session initialization tracking
- `user_prompt_submit.py` - User prompt logging, session data management
- `pre_tool_use.py` - Tool call validation and dangerous command blocking
- `post_tool_use.py` - Tool completion logging
- `send_event.py` - Central event dispatcher to backend server
- `status_line_v6.py` - Context window usage display

**Utilities in `hooks/utils/`:**
- `summarizer.py` - AI-generated event summaries
- `model_extractor.py` - Extract model info from transcripts
- `hitl.py` - Human-in-the-loop helpers
- `llm/` - LLM API helpers (Anthropic, OpenAI)
- `tts/` - Text-to-speech integrations

### 2. Backend (`backend/`)
FastAPI server that:
- Receives events via `POST /events`
- Stores events in SQLite (`events.db`)
- Provides REST API for frontend queries
- Serves real-time event stream via Server-Sent Events (SSE)

**Stack:** Python 3.11+, FastAPI, Uvicorn, SQLite

**Key files:**
- `main.py` - FastAPI app, route definitions
- `events.py` - Event models and validation
- `database.py` - SQLite schema and queries
- `test_events.py` - Integration test script

### 3. Frontend (`frontend/`)
React dashboard for visualizing session data:
- Session list view with status and metrics
- Session detail view with event timeline
- Real-time monitoring and charts
- Tool usage statistics and error tracking

**Stack:** TypeScript, React 19, Vite

## Development Workflow

### Running the Full Stack

1. **Start backend** (terminal 1):
   ```bash
   cd backend
   source venv/bin/activate  # or create venv if needed
   uvicorn main:app --reload
   ```

2. **Start frontend** (terminal 2):
   ```bash
   cd frontend
   npm run dev
   ```

3. **Use Claude Code normally** - events automatically flow to dashboard at `http://localhost:5173`

### Testing

Generate test events:
```bash
python backend/test_events.py
```

This creates sample sessions with various tools, errors, and edge cases to populate the dashboard.

## Key Conventions

### Hook Development
- **Speed matters**: Hooks run synchronously. Keep them fast.
- **Error handling**: Hooks should never crash Claude Code. Wrap risky operations in try/except.
- **Logging**: Use JSON for structured logs in `logs/`
- **Dependencies**: Declare inline with `uv` script directives (`# /// script`)

### Event Schema
Events sent to backend include:
- `event_type` - Event name (e.g., "PreToolUse", "SessionStart")
- `timestamp` - ISO 8601 format
- `session_id` - UUID for grouping events
- `model` - Claude model being used
- Event-specific fields (tool names, error messages, etc.)

### Frontend State
- Use React hooks for state management
- Fetch from `/api/*` endpoints
- Subscribe to `/stream` for real-time updates
- Keep UI responsive during high event volume

## Important Paths

- `.claude/hooks/` - Hook scripts
- `.claude/settings.json` - Hook configuration
- `logs/` - Event logs (JSON files)
- `backend/events.db` - SQLite database
- `backend/main.py` - Backend entry point
- `frontend/src/` - React components

## Common Tasks

### Adding a New Event Type
1. Add hook script to `.claude/hooks/`
2. Register in `.claude/settings.json`
3. Update backend event model in `events.py`
4. Add database schema support in `database.py`
5. Update frontend UI components

### Debugging Hook Issues
- Check `backend/server.log` for backend errors
- Check `logs/` for event JSON structure
- Use `--reload` with uvicorn for live backend changes
- Test hooks independently with sample event data

### Database Changes
- Database is SQLite, schema in `database.py`
- Delete `events.db` to reset (dev only)
- Use `test_events.py` to repopulate test data

## Technical Constraints

- **Hook performance**: Must not slow down Claude Code session
- **Database size**: SQLite can grow large; consider cleanup strategies for production
- **Real-time requirements**: Frontend expects sub-second event updates
- **Concurrent sessions**: System should handle multiple Claude Code sessions simultaneously
- **Error isolation**: Hook failures should not break Claude Code functionality

## Hook Safety

The `pre_tool_use.py` hook implements safety checks:
- **Dangerous rm blocks**: `rm -rf` is blocked except in allowed directories
- Tool call summaries logged for debugging
- Validation happens before tool execution

## Status Line

`status_line_v6.py` displays context window usage:
```
[Model] # [###---] | 42.5% used | ~115k left | session_id
```

Color-coded: green (<50%), yellow (<75%), red (<90%)

## Environment Variables

- `CLAUDE_HOOKS_LOG_DIR` - Custom log directory (default: `logs/`)
- Backend uses `.env` for configuration (if needed)

## Notes for AI Assistants

When working on this codebase:
- **Hook changes**: Test with real Claude Code sessions, not just unit tests
- **Backend changes**: Use `uvicorn --reload` for fast iteration
- **Frontend changes**: Vite hot reload handles most updates
- **Event schema changes**: Update all three components (hook, backend, frontend)
- **Performance**: Profile hooks if Claude Code feels slow
- **Database queries**: Keep them simple; SQLite is fast enough for this use case
