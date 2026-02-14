# CCR: Claude Code Radar

*"I see a bad moon rising, I see trouble on the way"* 🎵

Real-time monitoring and logging hooks for Claude Code sessions.

## What This Does

This project implements Claude Code hooks that:

1. **Log events to JSON files** in the `logs/` directory
2. **Send events to an HTTP server** at `http://localhost:8000/events`
3. **Display a custom status line** showing context window usage

## Logged Events

The hooks capture these Claude Code events:

- `SessionStart` - Session initialization (startup/resume/clear)
- `SessionEnd` - Session termination
- `UserPromptSubmit` - User prompts
- `PreToolUse` - Before tool execution
- `PostToolUse` - After successful tool execution
- `PostToolUseFailure` - Tool execution failures
- `PermissionRequest` - Permission prompts
- `Notification` - System notifications
- `SubagentStart` - Subagent creation
- `SubagentStop` - Subagent termination
- `PreCompact` - Context window compaction
- `Stop` - Session interruptions
- `AssistantMessage` - Claude's text responses (extracted from transcript)

## Log Files

Events are logged to:

- `logs/session_start.json` - Session starts
- `logs/user_prompt_submit.json` - User prompts
- `logs/{session_id}/pre_tool_use.json` - Tool calls before execution
- `logs/{session_id}/post_tool_use.json` - Tool completions

The log directory location can be customized with the `CLAUDE_HOOKS_LOG_DIR` environment variable.

## Event Sending

The `send_event.py` hook sends events to an HTTP server with:

- Event type and timestamp
- Session ID and model name
- Event-specific fields (tool names, error messages, etc.)
- Optional AI-generated event summaries (when `--summarize` flag is used)
- Optional chat transcript (when `--add-chat` flag is used)

Default server: `http://localhost:8000/events`

## Tool Call Validation

The `pre_tool_use.py` hook blocks dangerous commands:

- **Dangerous rm commands**: `rm -rf` is blocked except in allowed directories (`trees/`)
- Tool call summaries are logged for Bash, Write, Edit, Read, Glob, Grep, WebFetch, WebSearch, Task, and other tools

## Session Management

`user_prompt_submit.py` stores:
- User prompts in `.claude/data/sessions/{session_id}.json`
- Optional AI-generated agent names for sessions (when `--name-agent` flag is used)

## Assistant Message Extraction

Claude's text responses are automatically extracted from the transcript by two hooks:

**`post_tool_use.py`** - Captures messages during tool execution:
- Runs after each tool completes
- Extracts assistant messages that appear after the tool

**`stop.py`** - Captures final messages:
- Runs when Claude completes its turn
- Ensures text-only responses (no tools) are captured
- Catches the final message in every turn

Both hooks:
- Read the session transcript file (`.jsonl` format)
- Extract new assistant text messages since last check
- Send each message as an `AssistantMessage` event to the backend
- Share state in `logs/{session_id}/assistant_messages_state.json` to prevent duplicates

## Status Line

`status_line_v6.py` displays:
```
[Model] # [###---] | 42.5% used | ~115k left | session_id
```

Shows:
- Model name
- Visual progress bar
- Context window usage percentage (color-coded: green < 50%, yellow < 75%, red < 90%)
- Remaining tokens
- Session ID

## Hook Configuration

All hooks are configured in `.claude/settings.json`. Each event type runs two hooks:
1. Event-specific logging script
2. `send_event.py` to send the event to the HTTP server

## Requirements

Python 3.8+ with dependencies managed by `uv` inline script declarations.

Core dependencies:
- `python-dotenv` (optional)
- `anthropic` (for `send_event.py` summarization)

## Project Structure

```
.claude/
├── hooks/
│   ├── session_start.py      # Logs session starts
│   ├── session_end.py         # Logs session ends
│   ├── user_prompt_submit.py  # Logs user prompts, manages session data
│   ├── pre_tool_use.py        # Validates and logs tool calls
│   ├── post_tool_use.py       # Logs tool completions, extracts assistant messages
│   ├── send_event.py          # Sends events to HTTP server
│   ├── notification.py        # Logs notifications
│   ├── permission_request.py  # Logs permission requests
│   ├── stop.py                # Logs session stops, extracts final assistant messages
│   ├── subagent_start.py      # Logs subagent starts
│   ├── subagent_stop.py       # Logs subagent stops
│   ├── pre_compact.py         # Logs context compaction
│   ├── post_tool_use_failure.py # Logs tool failures
│   └── utils/
│       ├── constants.py       # Log directory constants
│       ├── summarizer.py      # Event summarization
│       ├── model_extractor.py # Extract model from transcript
│       ├── assistant_extractor.py # Extract assistant messages from transcript
│       ├── hitl.py            # Human-in-the-loop utilities
│       ├── llm/               # LLM API helpers (anth.py, oai.py)
│       └── tts/               # Text-to-speech (pyttsx3, openai, elevenlabs)
├── status_lines/
│   └── status_line_v6.py      # Context window status display
└── settings.json              # Hook configuration

logs/                          # Event logs written here
```

## Running the Dashboard

The observability dashboard provides real-time monitoring and analysis of Claude Code sessions.

### Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (optional but recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the backend server:
```bash
uvicorn main:app --reload
```

The backend server will start on `http://localhost:8000`

### Frontend Setup

1. In a new terminal, navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

The frontend will be available at `http://localhost:5173`

### Testing the Dashboard

Test the event processing and dashboard views:

```bash
# From the project root
python backend/test_events.py
```

This will:
- Send sample events to the backend
- Create test sessions with various tools and errors
- Populate the dashboard with example data

### Usage Guide

1. **Start both servers**: Backend on port 8000, frontend on port 5173
2. **Configure Claude Code**: Ensure `.claude/settings.json` has hooks configured to send events to `http://localhost:8000/events`
3. **Start a Claude Code session**: Events will automatically flow to the dashboard
4. **Monitor in real-time**: Open `http://localhost:5173` to see live session data

### Dashboard Views

#### Sessions View
- List of all Claude Code sessions
- Session status (active/completed)
- Duration and event counts
- Model information
- Click to view session details

#### Session Detail View
- Complete event timeline
- Tool usage statistics
- Error tracking
- Token usage over time
- Interactive charts for:
  - Tool usage frequency
  - Token consumption
  - Error distribution

#### Real-time Monitoring
- Live event stream
- Active session indicators
- Performance metrics
- Error alerts

### API Endpoints

The backend provides these REST endpoints:

- `POST /events` - Receive events from Claude Code hooks
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/{session_id}` - Get session details
- `GET /api/events` - Query events with filtering
- `GET /api/stats` - Get aggregate statistics
- `GET /stream` - Server-Sent Events (SSE) for real-time event stream
