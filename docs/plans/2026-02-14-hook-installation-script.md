# Hook Installation Script Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Python script that installs CCR monitoring hooks into target repositories, enabling centralized observability of Claude Code sessions.

**Architecture:** Script copies hook files from CCR project to target repo and intelligently merges CCR hooks into target's `.claude/settings.json` without destroying existing configuration. All events flow to centralized CCR backend at localhost:8000.

**Tech Stack:** Python 3.8+ (stdlib only: argparse, shutil, json, pathlib, sys)

---

## Task 1: Create Script Structure and Argument Parsing

**Files:**
- Create: `install_hooks.py`

**Step 1: Create script with argument parsing**

Create the script file with shebang, imports, and argument parsing:

```python
#!/usr/bin/env python3
"""
CCR Hook Installation Script

Installs Claude Code Radar monitoring hooks into target repositories.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='Install CCR monitoring hooks into a target repository',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python install_hooks.py ~/projects/my-app --source-app my-app
  python install_hooks.py ../other-repo --source-app payments --backend-url http://192.168.1.100:8000/events
        '''
    )

    parser.add_argument(
        'target_repo_path',
        type=str,
        help='Path to the repository to monitor'
    )

    parser.add_argument(
        '--source-app',
        type=str,
        required=True,
        help='Name to identify this repo in the dashboard'
    )

    parser.add_argument(
        '--backend-url',
        type=str,
        default='http://localhost:8000/events',
        help='Backend server URL (default: http://localhost:8000/events)'
    )

    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_arguments()
    print(f"Target: {args.target_repo_path}")
    print(f"Source app: {args.source_app}")
    print(f"Backend URL: {args.backend_url}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
```

**Step 2: Test argument parsing**

Run: `python install_hooks.py --help`
Expected: Help message with usage examples

Run: `python install_hooks.py /tmp/test --source-app test-app`
Expected: Prints target, source app, backend URL (default)

Run: `python install_hooks.py /tmp/test --source-app test-app --backend-url http://example.com/events`
Expected: Prints custom backend URL

**Step 3: Commit**

```bash
git add install_hooks.py
git commit -m "feat: add argument parsing for hook installer"
```

---

## Task 2: Add CCR Project Validation

**Files:**
- Modify: `install_hooks.py`

**Step 1: Add validation function**

Add this function before `main()`:

```python
def validate_ccr_project():
    """Validate that we're running from CCR project root."""
    ccr_root = Path.cwd()
    send_event_hook = ccr_root / '.claude' / 'hooks' / 'send_event.py'

    if not send_event_hook.exists():
        print("Error: Must run this script from CCR project root", file=sys.stderr)
        print(f"Expected to find: {send_event_hook}", file=sys.stderr)
        sys.exit(1)

    return ccr_root
```

**Step 2: Call validation in main**

Update `main()` to call validation:

```python
def main():
    """Main entry point."""
    args = parse_arguments()

    # Validate we're in CCR project
    ccr_root = validate_ccr_project()
    print(f"✓ Running from CCR project: {ccr_root}")

    print(f"Target: {args.target_repo_path}")
    print(f"Source app: {args.source_app}")
    print(f"Backend URL: {args.backend_url}")
    return 0
```

**Step 3: Test validation**

Run from CCR project root: `python install_hooks.py /tmp/test --source-app test`
Expected: "✓ Running from CCR project: /path/to/ccr"

Run from different directory: `cd /tmp && python /path/to/ccr/install_hooks.py /tmp/test --source-app test`
Expected: Error message and exit code 1

**Step 4: Commit**

```bash
git add install_hooks.py
git commit -m "feat: add CCR project root validation"
```

---

## Task 3: Add Target Path Validation

**Files:**
- Modify: `install_hooks.py`

**Step 1: Add validation function**

Add this function after `validate_ccr_project()`:

```python
def validate_target_path(target_path_str):
    """Validate that target path exists and is a directory."""
    target_path = Path(target_path_str).resolve()

    if not target_path.exists():
        print(f"Error: Target path '{target_path}' does not exist", file=sys.stderr)
        sys.exit(1)

    if not target_path.is_dir():
        print(f"Error: Target path '{target_path}' is not a directory", file=sys.stderr)
        sys.exit(2)

    return target_path
```

**Step 2: Call validation in main**

Update `main()`:

```python
def main():
    """Main entry point."""
    args = parse_arguments()

    # Validate we're in CCR project
    ccr_root = validate_ccr_project()
    print(f"✓ Running from CCR project: {ccr_root}")

    # Validate target path
    target_path = validate_target_path(args.target_repo_path)
    print(f"✓ Target path validated: {target_path}")

    print(f"Source app: {args.source_app}")
    print(f"Backend URL: {args.backend_url}")
    return 0
```

**Step 3: Test validation**

Create test directory: `mkdir -p /tmp/test-repo`
Run: `python install_hooks.py /tmp/test-repo --source-app test`
Expected: "✓ Target path validated: /tmp/test-repo"

Run: `python install_hooks.py /tmp/does-not-exist --source-app test`
Expected: Error message and exit code 1

Run: `touch /tmp/testfile && python install_hooks.py /tmp/testfile --source-app test`
Expected: Error "is not a directory" and exit code 2

**Step 4: Commit**

```bash
git add install_hooks.py
git commit -m "feat: add target path validation"
```

---

## Task 4: Implement File Copying

**Files:**
- Modify: `install_hooks.py`

**Step 1: Add file copy function**

Add this function after `validate_target_path()`:

```python
def copy_hook_files(ccr_root, target_path):
    """Copy hook files from CCR project to target repository."""
    try:
        # Copy all hook scripts
        src_hooks = ccr_root / '.claude' / 'hooks'
        dst_hooks = target_path / '.claude' / 'hooks'

        # Create destination directory
        dst_hooks.mkdir(parents=True, exist_ok=True)

        # Copy all .py files (excluding test files)
        hook_count = 0
        for hook_file in src_hooks.glob('*.py'):
            if not hook_file.name.startswith('test_'):
                shutil.copy2(hook_file, dst_hooks / hook_file.name)
                hook_count += 1

        print(f"✓ Copied {hook_count} hook scripts to {dst_hooks}")

        # Copy utils directory
        src_utils = src_hooks / 'utils'
        dst_utils = dst_hooks / 'utils'

        if dst_utils.exists():
            shutil.rmtree(dst_utils)

        shutil.copytree(src_utils, dst_utils)
        print(f"✓ Copied utils directory")

        # Copy status line script
        src_status = ccr_root / '.claude' / 'status_lines' / 'status_line_v6.py'
        dst_status_dir = target_path / '.claude' / 'status_lines'
        dst_status_dir.mkdir(parents=True, exist_ok=True)

        shutil.copy2(src_status, dst_status_dir / 'status_line_v6.py')
        print(f"✓ Copied status line script")

    except Exception as e:
        print(f"Error: Failed to copy files: {e}", file=sys.stderr)
        sys.exit(3)
```

**Step 2: Call copy function in main**

Update `main()`:

```python
def main():
    """Main entry point."""
    args = parse_arguments()

    # Validate we're in CCR project
    ccr_root = validate_ccr_project()
    print(f"✓ Running from CCR project: {ccr_root}")

    # Validate target path
    target_path = validate_target_path(args.target_repo_path)
    print(f"✓ Target path validated: {target_path}")

    # Copy hook files
    copy_hook_files(ccr_root, target_path)

    print(f"Source app: {args.source_app}")
    print(f"Backend URL: {args.backend_url}")
    return 0
```

**Step 3: Test file copying**

Run: `python install_hooks.py /tmp/test-repo --source-app test`
Expected: Success messages for hooks, utils, status line

Verify: `ls /tmp/test-repo/.claude/hooks/`
Expected: All hook .py files present (no test_ files)

Verify: `ls /tmp/test-repo/.claude/hooks/utils/`
Expected: Utils directory with subdirectories

Verify: `ls /tmp/test-repo/.claude/status_lines/`
Expected: status_line_v6.py present

**Step 4: Commit**

```bash
git add install_hooks.py
git commit -m "feat: implement hook file copying"
```

---

## Task 5: Implement Settings Loading

**Files:**
- Modify: `install_hooks.py`

**Step 1: Add settings loader function**

Add this function after `copy_hook_files()`:

```python
def load_settings(target_path):
    """Load existing settings.json from target repo, or return empty dict."""
    settings_file = target_path / '.claude' / 'settings.json'

    if not settings_file.exists():
        return {}

    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Target settings.json is malformed: {e}", file=sys.stderr)
        print(f"Please fix {settings_file} and try again", file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print(f"Error: Failed to read settings.json: {e}", file=sys.stderr)
        sys.exit(3)
```

**Step 2: Call loader in main**

Update `main()`:

```python
def main():
    """Main entry point."""
    args = parse_arguments()

    # Validate we're in CCR project
    ccr_root = validate_ccr_project()
    print(f"✓ Running from CCR project: {ccr_root}")

    # Validate target path
    target_path = validate_target_path(args.target_repo_path)
    print(f"✓ Target path validated: {target_path}")

    # Copy hook files
    copy_hook_files(ccr_root, target_path)

    # Load existing settings
    existing_settings = load_settings(target_path)
    if existing_settings:
        print(f"✓ Loaded existing settings.json")
    else:
        print(f"✓ No existing settings.json (will create new)")

    print(f"Source app: {args.source_app}")
    print(f"Backend URL: {args.backend_url}")
    return 0
```

**Step 3: Test settings loading**

Test with no settings: `python install_hooks.py /tmp/test-repo --source-app test`
Expected: "No existing settings.json"

Test with existing settings:
```bash
mkdir -p /tmp/test-repo2/.claude
echo '{"hooks":{}}' > /tmp/test-repo2/.claude/settings.json
python install_hooks.py /tmp/test-repo2 --source-app test
```
Expected: "Loaded existing settings.json"

Test with malformed JSON:
```bash
mkdir -p /tmp/test-repo3/.claude
echo '{invalid json' > /tmp/test-repo3/.claude/settings.json
python install_hooks.py /tmp/test-repo3 --source-app test
```
Expected: Error message about malformed JSON and exit code 3

**Step 4: Commit**

```bash
git add install_hooks.py
git commit -m "feat: implement settings.json loading"
```

---

## Task 6: Build CCR Hooks Configuration

**Files:**
- Modify: `install_hooks.py`

**Step 1: Add config builder function**

Add this function after `load_settings()`:

```python
def build_ccr_hooks_config(source_app, backend_url):
    """Build CCR hooks configuration object."""
    # Define all hook events and their configurations
    hook_events = {
        'PreToolUse': ['--summarize'],
        'PostToolUse': ['--summarize'],
        'PostToolUseFailure': ['--summarize'],
        'PermissionRequest': ['--summarize'],
        'Notification': ['--summarize'],
        'SubagentStart': [],
        'SubagentStop': [],
        'Stop': ['--add-chat'],
        'PreCompact': [],
        'UserPromptSubmit': ['--summarize'],
        'SessionStart': [],
        'SessionEnd': [],
    }

    config = {
        'hooks': {},
        'statusLine': {
            'type': 'command',
            'command': 'uv run $CLAUDE_PROJECT_DIR/.claude/status_lines/status_line_v6.py',
            'padding': 0
        }
    }

    # Build hook configuration for each event type
    for event_type, extra_args in hook_events.items():
        # First hook: the event-specific script (if it exists)
        event_script = f"{event_type[0].lower()}{event_type[1:]}"  # PreToolUse -> preToolUse
        # Convert to snake_case
        event_script = ''.join(['_' + c.lower() if c.isupper() else c for c in event_script]).lstrip('_')

        hooks_list = [
            {
                'type': 'command',
                'command': f'uv run $CLAUDE_PROJECT_DIR/.claude/hooks/{event_script}.py'
            },
            {
                'type': 'command',
                'command': f'uv run $CLAUDE_PROJECT_DIR/.claude/hooks/send_event.py --source-app {source_app} --event-type {event_type}' +
                          (f' {" ".join(extra_args)}' if extra_args else '') +
                          (f' --server-url {backend_url}' if backend_url != 'http://localhost:8000/events' else '')
            }
        ]

        config['hooks'][event_type] = [
            {
                'matcher': '',
                'hooks': hooks_list
            }
        ]

    return config
```

**Step 2: Call builder in main**

Update `main()`:

```python
def main():
    """Main entry point."""
    args = parse_arguments()

    # Validate we're in CCR project
    ccr_root = validate_ccr_project()
    print(f"✓ Running from CCR project: {ccr_root}")

    # Validate target path
    target_path = validate_target_path(args.target_repo_path)
    print(f"✓ Target path validated: {target_path}")

    # Copy hook files
    copy_hook_files(ccr_root, target_path)

    # Load existing settings
    existing_settings = load_settings(target_path)
    if existing_settings:
        print(f"✓ Loaded existing settings.json")
    else:
        print(f"✓ No existing settings.json (will create new)")

    # Build CCR hooks configuration
    ccr_config = build_ccr_hooks_config(args.source_app, args.backend_url)
    print(f"✓ Built CCR hooks configuration for '{args.source_app}'")

    return 0
```

**Step 3: Test config building**

Run: `python install_hooks.py /tmp/test-repo --source-app my-app`
Expected: "Built CCR hooks configuration for 'my-app'"

Run with custom backend: `python install_hooks.py /tmp/test-repo --source-app test --backend-url http://example.com/events`
Expected: Success (backend URL embedded in config)

**Step 4: Commit**

```bash
git add install_hooks.py
git commit -m "feat: implement CCR hooks config builder"
```

---

## Task 7: Implement Settings Merging

**Files:**
- Modify: `install_hooks.py`

**Step 1: Add merge function**

Add this function after `build_ccr_hooks_config()`:

```python
def merge_settings(existing, ccr_config):
    """Merge CCR config into existing settings without destroying user config."""
    merged = existing.copy()

    # Always set/overwrite status line
    merged['statusLine'] = ccr_config['statusLine']

    # Ensure hooks object exists
    if 'hooks' not in merged:
        merged['hooks'] = {}

    # Merge each hook event
    for event_type, ccr_hook_config in ccr_config['hooks'].items():
        if event_type not in merged['hooks']:
            # Event doesn't exist, add it directly
            merged['hooks'][event_type] = ccr_hook_config
        else:
            # Event exists, append CCR hooks to existing hooks
            existing_event = merged['hooks'][event_type]

            # existing_event is a list of matcher objects
            # We need to append CCR hooks to the first matcher's hooks array
            if existing_event and len(existing_event) > 0:
                # Find the matcher with empty string or append to first
                target_matcher = existing_event[0]

                # Append CCR hooks to this matcher's hooks list
                ccr_hooks = ccr_hook_config[0]['hooks']
                target_matcher['hooks'].extend(ccr_hooks)
            else:
                # No existing matchers, just add CCR config
                merged['hooks'][event_type] = ccr_hook_config

    return merged
```

**Step 2: Call merge in main**

Update `main()`:

```python
def main():
    """Main entry point."""
    args = parse_arguments()

    # Validate we're in CCR project
    ccr_root = validate_ccr_project()
    print(f"✓ Running from CCR project: {ccr_root}")

    # Validate target path
    target_path = validate_target_path(args.target_repo_path)
    print(f"✓ Target path validated: {target_path}")

    # Copy hook files
    copy_hook_files(ccr_root, target_path)

    # Load existing settings
    existing_settings = load_settings(target_path)
    if existing_settings:
        print(f"✓ Loaded existing settings.json")
    else:
        print(f"✓ No existing settings.json (will create new)")

    # Build CCR hooks configuration
    ccr_config = build_ccr_hooks_config(args.source_app, args.backend_url)
    print(f"✓ Built CCR hooks configuration for '{args.source_app}'")

    # Merge configurations
    merged_settings = merge_settings(existing_settings, ccr_config)
    print(f"✓ Merged CCR hooks with existing configuration")

    return 0
```

**Step 3: Test merging logic**

Run with no existing settings: `python install_hooks.py /tmp/test-repo --source-app test`
Expected: Success

Run with existing settings:
```bash
mkdir -p /tmp/test-repo2/.claude
cat > /tmp/test-repo2/.claude/settings.json << 'EOF'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {"type": "command", "command": "echo 'custom'"}
        ]
      }
    ]
  }
}
EOF
python install_hooks.py /tmp/test-repo2 --source-app test
```
Expected: "Merged CCR hooks with existing configuration"

**Step 4: Commit**

```bash
git add install_hooks.py
git commit -m "feat: implement settings merging logic"
```

---

## Task 8: Implement Settings Writing

**Files:**
- Modify: `install_hooks.py`

**Step 1: Add write function**

Add this function after `merge_settings()`:

```python
def write_settings(target_path, merged_settings):
    """Write merged settings to target repo's settings.json."""
    settings_file = target_path / '.claude' / 'settings.json'

    try:
        # Ensure .claude directory exists
        settings_file.parent.mkdir(parents=True, exist_ok=True)

        # Write with pretty formatting
        with open(settings_file, 'w') as f:
            json.dump(merged_settings, f, indent=2)

        print(f"✓ Updated .claude/settings.json (merged with existing config)")

    except Exception as e:
        print(f"Error: Failed to write settings.json: {e}", file=sys.stderr)
        sys.exit(3)
```

**Step 2: Call write in main and add success message**

Update `main()`:

```python
def main():
    """Main entry point."""
    args = parse_arguments()

    # Validate we're in CCR project
    ccr_root = validate_ccr_project()
    print(f"✓ Running from CCR project: {ccr_root}")

    # Validate target path
    target_path = validate_target_path(args.target_repo_path)
    print(f"✓ Target path validated: {target_path}")

    # Copy hook files
    copy_hook_files(ccr_root, target_path)

    # Load existing settings
    existing_settings = load_settings(target_path)
    if existing_settings:
        print(f"✓ Loaded existing settings.json")
    else:
        print(f"✓ No existing settings.json (will create new)")

    # Build CCR hooks configuration
    ccr_config = build_ccr_hooks_config(args.source_app, args.backend_url)
    print(f"✓ Built CCR hooks configuration for '{args.source_app}'")

    # Merge configurations
    merged_settings = merge_settings(existing_settings, ccr_config)
    print(f"✓ Merged CCR hooks with existing configuration")

    # Write merged settings
    write_settings(target_path, merged_settings)

    # Print success message with next steps
    print("\nInstallation complete!\n")
    print("Next steps:")
    print(f"1. Start CCR backend: cd {ccr_root} && uvicorn backend.main:app")
    print(f"2. Start CCR frontend: cd {ccr_root}/frontend && npm run dev")
    print(f"3. Use Claude Code in {target_path} - events will appear in dashboard")

    return 0
```

**Step 3: Test full installation**

Run full installation: `python install_hooks.py /tmp/test-repo --source-app test-app`
Expected: All success messages and next steps

Verify settings.json: `cat /tmp/test-repo/.claude/settings.json`
Expected: Valid JSON with hooks and statusLine

Test with existing settings:
```bash
mkdir -p /tmp/test-repo2/.claude
echo '{"env":{"FOO":"bar"}}' > /tmp/test-repo2/.claude/settings.json
python install_hooks.py /tmp/test-repo2 --source-app test
cat /tmp/test-repo2/.claude/settings.json
```
Expected: JSON contains both env (preserved) and hooks/statusLine (added)

**Step 4: Commit**

```bash
git add install_hooks.py
git commit -m "feat: implement settings writing and complete installation flow"
```

---

## Task 9: Fix Hook Script Naming Convention

**Files:**
- Modify: `install_hooks.py` (fix `build_ccr_hooks_config()`)

**Step 1: Fix the event-to-filename mapping**

The current camelCase to snake_case conversion is incorrect. Replace `build_ccr_hooks_config()` with the corrected version:

```python
def build_ccr_hooks_config(source_app, backend_url):
    """Build CCR hooks configuration object."""
    # Map event types to their actual hook script filenames
    event_to_script = {
        'PreToolUse': 'pre_tool_use.py',
        'PostToolUse': 'post_tool_use.py',
        'PostToolUseFailure': 'post_tool_use_failure.py',
        'PermissionRequest': 'permission_request.py',
        'Notification': 'notification.py',
        'SubagentStart': 'subagent_start.py',
        'SubagentStop': 'subagent_stop.py',
        'Stop': 'stop.py',
        'PreCompact': 'pre_compact.py',
        'UserPromptSubmit': 'user_prompt_submit.py',
        'SessionStart': 'session_start.py',
        'SessionEnd': 'session_end.py',
    }

    # Define which events need extra flags for send_event.py
    event_extra_args = {
        'PreToolUse': ['--summarize'],
        'PostToolUse': ['--summarize'],
        'PostToolUseFailure': ['--summarize'],
        'PermissionRequest': ['--summarize'],
        'Notification': ['--summarize'],
        'Stop': ['--add-chat'],
        'UserPromptSubmit': ['--summarize'],
    }

    config = {
        'hooks': {},
        'statusLine': {
            'type': 'command',
            'command': 'uv run $CLAUDE_PROJECT_DIR/.claude/status_lines/status_line_v6.py',
            'padding': 0
        }
    }

    # Build hook configuration for each event type
    for event_type, script_name in event_to_script.items():
        extra_args = event_extra_args.get(event_type, [])

        # Build send_event.py command
        send_event_cmd = f'uv run $CLAUDE_PROJECT_DIR/.claude/hooks/send_event.py --source-app {source_app} --event-type {event_type}'

        if extra_args:
            send_event_cmd += f' {" ".join(extra_args)}'

        if backend_url != 'http://localhost:8000/events':
            send_event_cmd += f' --server-url {backend_url}'

        hooks_list = [
            {
                'type': 'command',
                'command': f'uv run $CLAUDE_PROJECT_DIR/.claude/hooks/{script_name}'
            },
            {
                'type': 'command',
                'command': send_event_cmd
            }
        ]

        config['hooks'][event_type] = [
            {
                'matcher': '',
                'hooks': hooks_list
            }
        ]

    return config
```

**Step 2: Test corrected mapping**

Run: `python install_hooks.py /tmp/test-repo --source-app test`
Expected: Success

Verify settings: `cat /tmp/test-repo/.claude/settings.json | grep "pre_tool_use.py"`
Expected: Command references correct script filename

**Step 3: Commit**

```bash
git add install_hooks.py
git commit -m "fix: correct hook script filename mapping"
```

---

## Task 10: Handle Hook Scripts That Don't Require Arguments

**Files:**
- Modify: `install_hooks.py` (update script references based on actual hooks)

**Step 1: Review actual hook files**

Check which hooks need special arguments:

Run: `head -n 20 .claude/hooks/user_prompt_submit.py`

Look for argparse usage to see what flags are needed.

**Step 2: Update hook commands with correct arguments**

Based on the actual hooks in the CCR project (from `.claude/settings.json`), update the hook commands in `build_ccr_hooks_config()` to match:

```python
def build_ccr_hooks_config(source_app, backend_url):
    """Build CCR hooks configuration object."""
    # Map event types to their hook configurations
    # Format: 'EventType': ('script.py', ['--arg1', '--arg2'])
    hook_configs = {
        'PreToolUse': ('pre_tool_use.py', []),
        'PostToolUse': ('post_tool_use.py', []),
        'PostToolUseFailure': ('post_tool_use_failure.py', []),
        'PermissionRequest': ('permission_request.py', []),
        'Notification': ('notification.py', []),
        'SubagentStart': ('subagent_start.py', []),
        'SubagentStop': ('subagent_stop.py', []),
        'Stop': ('stop.py', ['--chat']),
        'PreCompact': ('pre_compact.py', []),
        'UserPromptSubmit': ('user_prompt_submit.py', ['--log-only', '--store-last-prompt', '--name-agent']),
        'SessionStart': ('session_start.py', []),
        'SessionEnd': ('session_end.py', []),
    }

    # Define which events need extra flags for send_event.py
    send_event_extras = {
        'PreToolUse': ['--summarize'],
        'PostToolUse': ['--summarize'],
        'PostToolUseFailure': ['--summarize'],
        'PermissionRequest': ['--summarize'],
        'Notification': ['--summarize'],
        'Stop': ['--add-chat'],
        'UserPromptSubmit': ['--summarize'],
    }

    config = {
        'hooks': {},
        'statusLine': {
            'type': 'command',
            'command': 'uv run $CLAUDE_PROJECT_DIR/.claude/status_lines/status_line_v6.py',
            'padding': 0
        }
    }

    # Build hook configuration for each event type
    for event_type, (script_name, hook_args) in hook_configs.items():
        # Build first hook command (event-specific script)
        hook_cmd = f'uv run $CLAUDE_PROJECT_DIR/.claude/hooks/{script_name}'
        if hook_args:
            hook_cmd += f' {" ".join(hook_args)}'

        # Build send_event.py command
        send_event_cmd = f'uv run $CLAUDE_PROJECT_DIR/.claude/hooks/send_event.py --source-app {source_app} --event-type {event_type}'

        extra_args = send_event_extras.get(event_type, [])
        if extra_args:
            send_event_cmd += f' {" ".join(extra_args)}'

        if backend_url != 'http://localhost:8000/events':
            send_event_cmd += f' --server-url {backend_url}'

        hooks_list = [
            {
                'type': 'command',
                'command': hook_cmd
            },
            {
                'type': 'command',
                'command': send_event_cmd
            }
        ]

        config['hooks'][event_type] = [
            {
                'matcher': '',
                'hooks': hooks_list
            }
        ]

    return config
```

**Step 3: Test with corrected arguments**

Run: `python install_hooks.py /tmp/test-repo --source-app test`

Verify: `cat /tmp/test-repo/.claude/settings.json | grep UserPromptSubmit -A5`
Expected: user_prompt_submit.py with --log-only --store-last-prompt --name-agent

Verify: `cat /tmp/test-repo/.claude/settings.json | grep "Stop" -A5`
Expected: stop.py with --chat

**Step 4: Commit**

```bash
git add install_hooks.py
git commit -m "feat: add correct arguments to hook scripts"
```

---

## Task 11: Add Source App Validation

**Files:**
- Modify: `install_hooks.py`

**Step 1: Add validation in parse_arguments**

Update `parse_arguments()` to validate source app:

```python
def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='Install CCR monitoring hooks into a target repository',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python install_hooks.py ~/projects/my-app --source-app my-app
  python install_hooks.py ../other-repo --source-app payments --backend-url http://192.168.1.100:8000/events
        '''
    )

    parser.add_argument(
        'target_repo_path',
        type=str,
        help='Path to the repository to monitor'
    )

    parser.add_argument(
        '--source-app',
        type=str,
        required=True,
        help='Name to identify this repo in the dashboard'
    )

    parser.add_argument(
        '--backend-url',
        type=str,
        default='http://localhost:8000/events',
        help='Backend server URL (default: http://localhost:8000/events)'
    )

    args = parser.parse_args()

    # Validate source-app is not empty
    if not args.source_app or not args.source_app.strip():
        parser.error("--source-app cannot be empty")

    return args
```

**Step 2: Test validation**

Run: `python install_hooks.py /tmp/test --source-app ""`
Expected: Error "cannot be empty"

Run: `python install_hooks.py /tmp/test --source-app "  "`
Expected: Error "cannot be empty"

**Step 3: Commit**

```bash
git add install_hooks.py
git commit -m "feat: validate source-app is not empty"
```

---

## Task 12: Manual End-to-End Testing

**Files:**
- None (testing only)

**Step 1: Create test repository**

```bash
mkdir -p /tmp/test-ccr-install
cd /tmp/test-ccr-install
git init
```

**Step 2: Run installation**

From CCR project root:
```bash
python install_hooks.py /tmp/test-ccr-install --source-app test-install
```

Expected: All success messages

**Step 3: Verify file structure**

```bash
ls -la /tmp/test-ccr-install/.claude/hooks/
ls -la /tmp/test-ccr-install/.claude/hooks/utils/
ls -la /tmp/test-ccr-install/.claude/status_lines/
```

Expected: All hook files, utils directory, status line present

**Step 4: Verify settings.json**

```bash
cat /tmp/test-ccr-install/.claude/settings.json
```

Expected: Valid JSON with all 12 hook events and statusLine

**Step 5: Test merge with existing settings**

```bash
mkdir -p /tmp/test-merge/.claude
cat > /tmp/test-merge/.claude/settings.json << 'EOF'
{
  "env": {
    "MY_VAR": "value"
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {"type": "command", "command": "echo 'Before CCR'"}
        ]
      }
    ]
  }
}
EOF

python install_hooks.py /tmp/test-merge --source-app merge-test
cat /tmp/test-merge/.claude/settings.json
```

Expected:
- env.MY_VAR preserved
- PreToolUse has both echo command AND CCR hooks
- All other CCR hooks added

**Step 6: Test with custom backend URL**

```bash
python install_hooks.py /tmp/test-backend --source-app backend-test --backend-url http://192.168.1.100:9000/events
cat /tmp/test-backend/.claude/settings.json | grep server-url
```

Expected: send_event.py commands include `--server-url http://192.168.1.100:9000/events`

**Step 7: Clean up test repositories**

```bash
rm -rf /tmp/test-ccr-install /tmp/test-merge /tmp/test-backend /tmp/test-repo /tmp/test-repo2 /tmp/test-repo3
```

---

## Task 13: Add Usage Documentation

**Files:**
- Create: `README_INSTALL.md`

**Step 1: Create installation README**

```markdown
# Installing CCR Hooks

This guide explains how to install Claude Code Radar (CCR) monitoring hooks into your repositories.

## Prerequisites

- Python 3.8 or higher
- CCR project cloned locally

## Installation Steps

1. **Clone CCR repository** (if not already done):
   ```bash
   git clone <ccr-repo-url>
   cd claude_code_observability
   ```

2. **Install hooks into your target repository**:
   ```bash
   python install_hooks.py /path/to/your/repo --source-app your-app-name
   ```

   Example:
   ```bash
   python install_hooks.py ~/projects/my-backend --source-app my-backend
   ```

3. **Start CCR backend**:
   ```bash
   cd backend
   source venv/bin/activate  # or create venv if needed
   uvicorn main:app --reload
   ```

4. **Start CCR frontend** (in a new terminal):
   ```bash
   cd frontend
   npm install  # first time only
   npm run dev
   ```

5. **Use Claude Code in your monitored repository**:
   ```bash
   cd /path/to/your/repo
   claude
   ```

   All events will appear in the CCR dashboard at `http://localhost:5173`

## Advanced Usage

### Custom Backend URL

If your CCR backend runs on a different machine or port:

```bash
python install_hooks.py /path/to/repo --source-app app-name --backend-url http://192.168.1.100:8000/events
```

### Monitoring Multiple Repositories

You can install hooks into multiple repos - each will show up separately in the dashboard:

```bash
python install_hooks.py ~/projects/backend --source-app backend-api
python install_hooks.py ~/projects/frontend --source-app frontend-app
python install_hooks.py ~/projects/ml-service --source-app ml-pipeline
```

All repos will send events to the same CCR backend, identified by their `--source-app` name.

### Re-installing or Updating Hooks

To update hooks in a repo (e.g., after updating CCR):

```bash
python install_hooks.py /path/to/repo --source-app app-name
```

This will overwrite hook files and merge with existing settings.json safely.

## What Gets Installed

The script copies:
- All hook scripts (`.claude/hooks/*.py`)
- Utilities directory (`.claude/hooks/utils/`)
- Status line script (`.claude/status_lines/status_line_v6.py`)

And updates:
- `.claude/settings.json` (merged with existing configuration)

## Existing Hooks

If your repository already has Claude Code hooks configured, the CCR hooks will be **appended** to existing hooks. Your custom hooks will continue to work.

## Troubleshooting

### "Must run this script from CCR project root"

Make sure you're running the script from the CCR project directory, not from your target repository.

### "Target path does not exist"

Check that you provided the correct path to your repository. Use absolute paths or relative paths from the CCR project root.

### "settings.json is malformed"

Your target repository has an invalid JSON file. Fix the JSON syntax in `.claude/settings.json` before re-running.

### Events not appearing in dashboard

1. Verify CCR backend is running: `curl http://localhost:8000/health` (if you have a health endpoint)
2. Check backend logs for errors
3. Verify hooks were installed: `ls /path/to/repo/.claude/hooks/`
4. Check `--source-app` name matches what you expect in dashboard

## Uninstalling

To remove CCR hooks from a repository, manually:
1. Delete `.claude/hooks/` directory (or just the CCR scripts)
2. Delete `.claude/status_lines/status_line_v6.py`
3. Edit `.claude/settings.json` to remove CCR hook entries

(Automated uninstall script coming in future version)
```

**Step 2: Commit documentation**

```bash
git add README_INSTALL.md
git commit -m "docs: add hook installation guide"
```

---

## Task 14: Final Testing and Validation

**Files:**
- None (final validation)

**Step 1: Test all error cases**

Run from wrong directory:
```bash
cd /tmp
python /path/to/ccr/install_hooks.py /tmp/test --source-app test
```
Expected: "Must run from CCR project root"

Test nonexistent path:
```bash
cd /path/to/ccr
python install_hooks.py /does/not/exist --source-app test
```
Expected: "Target path does not exist" with exit code 1

Test file instead of directory:
```bash
touch /tmp/testfile
python install_hooks.py /tmp/testfile --source-app test
```
Expected: "is not a directory" with exit code 2

Test empty source-app:
```bash
python install_hooks.py /tmp/test --source-app ""
```
Expected: "cannot be empty"

**Step 2: Test successful installation**

```bash
mkdir -p /tmp/final-test
python install_hooks.py /tmp/final-test --source-app final
```

Expected: All checkmarks, success message, next steps

**Step 3: Verify installed hooks match CCR template**

```bash
diff .claude/settings.json /tmp/final-test/.claude/settings.json
```

Expected: Only differences are source-app name

**Step 4: Test that installed hooks work (optional if backend is running)**

If backend is running:
```bash
cd /tmp/final-test
# Trigger a hook manually (SessionStart simulation)
echo '{"session_id":"test-123","hook_event_name":"SessionStart","source":"startup"}' | uv run .claude/hooks/send_event.py --source-app final --event-type SessionStart
```

Check backend logs for event received.

**Step 5: Final cleanup**

```bash
rm -rf /tmp/final-test /tmp/testfile
```

---

## Completion Checklist

- [ ] Script parses arguments correctly
- [ ] CCR project validation works
- [ ] Target path validation works
- [ ] Hook files are copied correctly
- [ ] Utilities directory is copied
- [ ] Status line script is copied
- [ ] Settings.json is loaded or created
- [ ] CCR hooks configuration is built correctly
- [ ] Settings merging preserves existing configuration
- [ ] Settings merging appends CCR hooks to existing hooks
- [ ] Merged settings are written correctly
- [ ] Error messages are clear and helpful
- [ ] Success message shows next steps
- [ ] Script works with custom backend URL
- [ ] Script handles all error cases gracefully
- [ ] Documentation is complete

## Next Steps After Implementation

1. Test installation in a real Claude Code session
2. Verify events flow to backend and appear in frontend
3. Test with multiple repositories sending to same backend
4. Consider adding features from "Future Enhancements" section

---

**Implementation complete!**
