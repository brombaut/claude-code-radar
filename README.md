# Claude Code Observability

Logging and monitoring hooks for Claude Code sessions.

## What This Does

This project implements Claude Code hooks that:

1. **Log events to JSON files** in the `logs/` directory
2. **Send events to an HTTP server** at `http://localhost:4000/events`
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

Default server: `http://localhost:4000/events`

## Tool Call Validation

The `pre_tool_use.py` hook blocks dangerous commands:

- **Dangerous rm commands**: `rm -rf` is blocked except in allowed directories (`trees/`)
- Tool call summaries are logged for Bash, Write, Edit, Read, Glob, Grep, WebFetch, WebSearch, Task, and other tools

## Session Management

`user_prompt_submit.py` stores:
- User prompts in `.claude/data/sessions/{session_id}.json`
- Optional AI-generated agent names for sessions (when `--name-agent` flag is used)

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
│   ├── post_tool_use.py       # Logs tool completions
│   ├── send_event.py          # Sends events to HTTP server
│   ├── notification.py        # Logs notifications
│   ├── permission_request.py  # Logs permission requests
│   ├── stop.py                # Logs session stops
│   ├── subagent_start.py      # Logs subagent starts
│   ├── subagent_stop.py       # Logs subagent stops
│   ├── pre_compact.py         # Logs context compaction
│   ├── post_tool_use_failure.py # Logs tool failures
│   └── utils/
│       ├── constants.py       # Log directory constants
│       ├── summarizer.py      # Event summarization
│       ├── model_extractor.py # Extract model from transcript
│       ├── hitl.py            # Human-in-the-loop utilities
│       ├── llm/               # LLM API helpers (anth.py, oai.py)
│       └── tts/               # Text-to-speech (pyttsx3, openai, elevenlabs)
├── status_lines/
│   └── status_line_v6.py      # Context window status display
└── settings.json              # Hook configuration

logs/                          # Event logs written here
```
