<table>
  <tr>
    <td><img src="assets/ccr-logo.png" alt="CCR Logo" width="150" height="150"></td>
    <td>
      <h1>CCR: Claude Code Radar</h1>
      <em>"I see a bad moon rising, I see trouble on the way"</em> 🎵<br><br>
      Real-time monitoring and logging hooks for Claude Code sessions.
    </td>
  </tr>
</table>

CCR captures every event during a Claude Code session—tool calls, prompts, errors, subagent activity, context compaction—and provides a live web dashboard for visualization and analysis.

## Quick Install

Copy the hooks into your project's `.claude/` directory:

```bash
# From this repo, copy hooks into your project
cp -r .claude/hooks /path/to/your/project/.claude/
cp -r .claude/status_lines /path/to/your/project/.claude/
```

Merge the hook configuration into your project's `.claude/settings.json`. The key section is the `hooks` block—see `.claude/settings.json` in this repo for the full configuration.

**Requirements:** `uv` must be installed for dependency management. Install it with:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

The hooks run automatically on every Claude Code event with no further setup needed.

## Starting the Dashboard

The dashboard shows live session data, token usage, tool timelines, and error tracking.

**Prerequisites:** Python 3.11+, Node.js 18+

**Backend** (terminal 1):
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend** (terminal 2):
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Start a Claude Code session—events flow to the dashboard automatically.

To populate the dashboard with sample data:
```bash
python backend/test_events.py
```

---

## What Gets Captured

The hooks capture these Claude Code events:

- `SessionStart` / `SessionEnd` - Session lifecycle
- `UserPromptSubmit` - User prompts
- `PreToolUse` / `PostToolUse` / `PostToolUseFailure` - Tool execution
- `AssistantMessage` - Claude's text responses (extracted from transcript)
- `SubagentStart` / `SubagentStop` - Subagent activity
- `PreCompact` - Context window compaction
- `PermissionRequest` / `Notification` / `Stop` - System events

## Status Line

`status_line_v6.py` adds a context window display to your Claude Code session:

```
[Model] # [###---] | 42.5% used | ~115k left | session_id
```

Color-coded: green (<50%), yellow (<75%), red (<90%).

## Log Files

Events are also written to local JSON files:

- `logs/session_start.json` - Session starts
- `logs/user_prompt_submit.json` - User prompts
- `logs/{session_id}/pre_tool_use.json` - Tool calls
- `logs/{session_id}/post_tool_use.json` - Tool completions

Set `CLAUDE_HOOKS_LOG_DIR` to customize the log directory.

## Hook Safety

`pre_tool_use.py` blocks dangerous commands—`rm -rf` is blocked except in explicitly allowed directories.

## Project Structure

```
.claude/
├── hooks/
│   ├── session_start.py
│   ├── session_end.py
│   ├── user_prompt_submit.py
│   ├── pre_tool_use.py
│   ├── post_tool_use.py
│   ├── post_tool_use_failure.py
│   ├── send_event.py
│   ├── notification.py
│   ├── permission_request.py
│   ├── stop.py
│   ├── subagent_start.py
│   ├── subagent_stop.py
│   ├── pre_compact.py
│   └── utils/
│       ├── constants.py
│       ├── summarizer.py
│       ├── model_extractor.py
│       ├── assistant_extractor.py
│       ├── hitl.py
│       ├── llm/               # Anthropic + OpenAI helpers
│       └── tts/               # Text-to-speech integrations
├── status_lines/
│   └── status_line_v6.py
└── settings.json

backend/                       # FastAPI server + SQLite
frontend/                      # React dashboard
logs/                          # Event logs
```

## Backend API

- `POST /events` - Receive events from hooks
- `GET /api/sessions` - List sessions
- `GET /api/sessions/{session_id}` - Session details
- `GET /api/events` - Query events with filtering
- `GET /api/stats` - Aggregate statistics
- `GET /stream` - Server-Sent Events for real-time updates

## Issue Tracking

This project uses [bd (beads)](https://github.com/steveyegge/beads) for issue tracking.

```bash
go install github.com/steveyegge/beads/cmd/bd@latest
bd init
bd ready        # list unblocked work
bd prime        # full workflow context
```
