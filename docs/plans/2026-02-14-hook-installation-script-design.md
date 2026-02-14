# Hook Installation Script Design

**Date:** 2026-02-14
**Status:** Approved

## Overview

A Python script that installs CCR (Claude Code Radar) monitoring hooks into target repositories. Users clone the CCR project, run this script to configure their repos for monitoring, then start CCR's backend/frontend to observe Claude Code sessions.

## Architecture Model

- **CCR Project**: The observability platform (this repo) - runs backend and frontend
- **Target Repos**: User's projects being monitored - have CCR hooks installed
- **Data Flow**: Target repo hooks → CCR backend (localhost:8000) → CCR frontend dashboard

## Script Interface

### Location
`install_hooks.py` at CCR project root

### Command-line Interface
```bash
python install_hooks.py <target_repo_path> --source-app <app_name> [--backend-url <url>]
```

### Arguments
- `target_repo_path` (positional, required): Path to repo to monitor
- `--source-app` (required): Name to identify this repo in dashboard
- `--backend-url` (optional): Backend URL (default: `http://localhost:8000/events`)

### Example Usage
```bash
# Basic usage
python install_hooks.py ~/projects/my-app --source-app my-app

# Custom backend URL
python install_hooks.py ../other-repo --source-app payments-service --backend-url http://192.168.1.100:8000/events
```

### Exit Codes
- 0: Success
- 1: Invalid arguments or target path doesn't exist
- 2: Target path is not a directory
- 3: Failed to copy files or merge settings

## File Operations

### What Gets Copied

1. **Hook Scripts** (14 files)
   - Source: `.claude/hooks/*.py`
   - Destination: `<target>/.claude/hooks/`

2. **Utilities Directory**
   - Source: `.claude/hooks/utils/` (entire folder)
   - Destination: `<target>/.claude/hooks/utils/`
   - Includes: `summarizer.py`, `model_extractor.py`, `hitl.py`, `llm/`, `tts/`

3. **Status Line Script**
   - Source: `.claude/status_lines/status_line_v6.py`
   - Destination: `<target>/.claude/status_lines/status_line_v6.py`

### Copy Behavior
- Create directories if they don't exist
- Overwrite files if they already exist (re-installation support)
- Preserve file permissions

### What Doesn't Get Copied
- Backend server code
- Frontend code
- Documentation
- Test files

## Settings.json Merging Strategy

### Goal
Add CCR hooks to `.claude/settings.json` without destroying existing configuration.

### Merging Logic

1. **Read existing settings**
   - Load `<target>/.claude/settings.json` if exists
   - Otherwise start with empty dict `{}`

2. **Merge top-level fields**
   - Add `"statusLine"` config (overwrites existing status line)
   - Merge into `"hooks"` object (create if doesn't exist)

3. **Hook event merging**
   - For each CCR event type (PreToolUse, PostToolUse, etc.):
     - If event doesn't exist: add CCR config directly
     - If event exists: append CCR hooks to existing hooks array

### Example Merge

**Before (existing target settings.json):**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {"type": "command", "command": "echo 'Custom hook'"}
        ]
      }
    ]
  }
}
```

**After merge:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {"type": "command", "command": "echo 'Custom hook'"},
          {"type": "command", "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/pre_tool_use.py"},
          {"type": "command", "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/send_event.py --source-app my-app --event-type PreToolUse --summarize"}
        ]
      }
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "uv run $CLAUDE_PROJECT_DIR/.claude/status_lines/status_line_v6.py",
    "padding": 0
  }
}
```

**Key Design Decision:** CCR hooks appended after existing hooks, so they run last.

## Validation & Error Handling

### Pre-flight Checks

1. **CCR project validation**
   - Verify script runs from CCR root (check for `.claude/hooks/send_event.py`)
   - Error: "Must run this script from CCR project root"

2. **Target path validation**
   - Check path exists
   - Check it's a directory
   - Error: "Target path '/foo/bar' does not exist"

3. **Source app validation**
   - Ensure `--source-app` provided and not empty
   - No character restrictions (user's choice)

### During Installation

1. **File copy errors**
   - Wrap in try/except
   - Print specific error and exit cleanly
   - Don't leave partial installation

2. **JSON parsing errors**
   - If existing settings.json malformed, print error
   - Ask user to fix JSON before re-running
   - Don't overwrite broken JSON

3. **JSON writing errors**
   - If write fails (permissions), print error
   - Original settings.json unchanged

### Success Output

```
✓ Copied 14 hook scripts to /path/to/target/.claude/hooks/
✓ Copied utils directory
✓ Copied status line script
✓ Updated .claude/settings.json (merged with existing config)

Installation complete!

Next steps:
1. Start CCR backend: cd /path/to/ccr && uvicorn backend.main:app
2. Start CCR frontend: cd /path/to/ccr/frontend && npm run dev
3. Use Claude Code in /path/to/target - events will appear in dashboard
```

### Error Handling Philosophy
- Fail fast with clear messages
- Don't leave partial state
- Exit with proper codes

## Overall Script Flow

```
1. Parse arguments (target_path, --source-app, --backend-url)
2. Validate CCR project structure (we're in the right place)
3. Validate target path (exists, is directory)
4. Copy hook files:
   - .claude/hooks/*.py → target/.claude/hooks/
   - .claude/hooks/utils/ → target/.claude/hooks/utils/
   - .claude/status_lines/status_line_v6.py → target/.claude/status_lines/
5. Read target's .claude/settings.json (or create empty dict)
6. Build CCR hooks config with user's --source-app and --backend-url
7. Merge CCR config into existing settings (append to hook arrays)
8. Write merged settings.json back to target
9. Print success message with next steps
```

## Script Structure

**Functions:**
- `main()` - Entry point, argument parsing
- `validate_ccr_project()` - Check we're in CCR root
- `validate_target_path(path)` - Check target exists
- `copy_hook_files(ccr_root, target_path)` - Copy all files
- `load_settings(target_path)` - Read existing settings.json or return {}
- `build_ccr_hooks_config(source_app, backend_url)` - Generate CCR hooks config
- `merge_settings(existing, ccr_config)` - Intelligent merge
- `write_settings(target_path, merged_settings)` - Save to disk

## Dependencies

**Python Standard Library Only:**
- `argparse` - Command-line parsing
- `shutil` - File operations
- `json` - Settings manipulation
- `pathlib` - Path handling
- `sys` - Exit codes

**No external packages required** - works immediately after cloning CCR.

## Future Enhancements (Not in Initial Version)

- `--dry-run` flag to preview changes
- `--uninstall` to remove CCR hooks from target repo
- `--list-monitored` to show all repos with CCR hooks
- Auto-detect source-app from git remote URL
- Interactive mode with prompts
- Validation that uv is installed

## Design Rationale

**Why Python over Bash:**
- No external dependencies (jq for JSON in bash)
- Cross-platform (Windows/Mac/Linux)
- Easier to maintain complex logic
- Better error handling

**Why copy over symlink:**
- Target repos become independent
- No broken links if CCR moves
- Users can modify hooks locally if needed
- Simpler mental model

**Why merge over replace:**
- Respects existing user configuration
- Non-destructive operation
- Allows CCR installation alongside other tools

**Why all hooks, not selective:**
- Complete monitoring out of the box
- Simpler UX and implementation
- Users can disable specific hooks manually later
