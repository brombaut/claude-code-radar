#!/usr/bin/env python3
"""
CCR (Claude Code Radar) Hook Installation Script

Installs monitoring hooks into target repositories to track Claude Code sessions.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='Install Claude Code Radar monitoring hooks into a target repository',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Install hooks to monitor a project
  %(prog)s /path/to/my-project --source-app my-project

  # Install with custom backend URL
  %(prog)s /path/to/repo --source-app repo-name --backend-url http://192.168.1.100:8000/events
"""
    )

    parser.add_argument(
        'target_repo_path',
        type=str,
        help='Path to the repository to monitor'
    )

    parser.add_argument(
        '--source-app',
        required=True,
        help='Name to identify this repository in the dashboard'
    )

    parser.add_argument(
        '--backend-url',
        default='http://localhost:8000/events',
        help='Backend server URL for event submission (default: http://localhost:8000/events)'
    )

    return parser.parse_args()


def validate_ccr_project():
    """Validate that we're running from the CCR project root."""
    ccr_root = Path.cwd()
    send_event_hook = ccr_root / '.claude' / 'hooks' / 'send_event.py'

    if not send_event_hook.exists():
        print("Error: Must run this script from CCR project root", file=sys.stderr)
        print(f"Expected to find: {send_event_hook}", file=sys.stderr)
        sys.exit(1)

    return ccr_root


def validate_target_path(target_path_str):
    """Validate the target repository path."""
    target_path = Path(target_path_str).resolve()

    if not target_path.exists():
        print(f"Error: Target path does not exist: {target_path}", file=sys.stderr)
        sys.exit(1)

    if not target_path.is_dir():
        print(f"Error: Target path is not a directory: {target_path}", file=sys.stderr)
        sys.exit(2)

    return target_path


def copy_hook_files(ccr_root, target_path):
    """Copy hook files from CCR project to target repository."""
    try:
        # Create .claude/hooks directory in target
        hooks_source = ccr_root / '.claude' / 'hooks'
        hooks_target = target_path / '.claude' / 'hooks'
        hooks_target.mkdir(parents=True, exist_ok=True)

        # Copy all .py files from hooks directory (excluding test files)
        py_files = list(hooks_source.glob('*.py'))
        copied_hooks = 0
        for source_file in py_files:
            if not source_file.name.startswith('test_'):
                target_file = hooks_target / source_file.name
                shutil.copy2(source_file, target_file)
                copied_hooks += 1

        print(f"✓ Copied {copied_hooks} hook files to {hooks_target}")

        # Copy utils directory
        utils_source = hooks_source / 'utils'
        utils_target = hooks_target / 'utils'

        # Remove existing utils directory to ensure clean state
        if utils_target.exists():
            shutil.rmtree(utils_target)

        # Copy entire utils directory
        shutil.copytree(utils_source, utils_target)
        utils_count = len(list(utils_target.rglob('*')))
        print(f"✓ Copied utils directory ({utils_count} files) to {utils_target}")

        # Create .claude/status_lines directory and copy status_line_v6.py
        status_source = ccr_root / '.claude' / 'status_lines' / 'status_line_v6.py'
        status_target_dir = target_path / '.claude' / 'status_lines'
        status_target_dir.mkdir(parents=True, exist_ok=True)

        status_target = status_target_dir / 'status_line_v6.py'
        shutil.copy2(status_source, status_target)
        print(f"✓ Copied status line to {status_target}")

    except Exception as e:
        print(f"Error copying hook files: {e}", file=sys.stderr)
        sys.exit(3)


def load_settings(target_path):
    """Load existing settings.json from target repository if it exists."""
    settings_file = target_path / '.claude' / 'settings.json'

    if not settings_file.exists():
        return {}

    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {settings_file}", file=sys.stderr)
        print(f"JSON error: {e}", file=sys.stderr)
        print("Please fix the JSON syntax and try again.", file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print(f"Error reading settings file {settings_file}: {e}", file=sys.stderr)
        sys.exit(3)


def build_ccr_hooks_config(source_app, backend_url):
    """Build CCR hooks configuration object."""
    # Define events and their extra arguments for send_event.py
    events = {
        'PreToolUse': '--summarize',
        'PostToolUse': '--summarize',
        'PostToolUseFailure': '--summarize',
        'PermissionRequest': '--summarize',
        'Notification': '--summarize',
        'SubagentStart': '--summarize',
        'SubagentStop': '--summarize',
        'Stop': '--add-chat',
        'PreCompact': '--summarize',
        'UserPromptSubmit': '',
        'SessionStart': '',
        'SessionEnd': ''
    }

    # Build hooks configuration
    hooks_config = {}

    for event_type, extra_args in events.items():
        # Convert camelCase to snake_case for script names
        # (This will be incorrect for some cases and fixed in Task 9)
        script_name = ''.join(
            '_' + char.lower() if char.isupper() else char
            for char in event_type
        ).lstrip('_') + '.py'

        # Build send_event.py command with arguments
        send_event_cmd = f"send_event.py --source-app {source_app} --event-type {event_type}"

        if extra_args:
            send_event_cmd += f" {extra_args}"

        # Add --server-url only if not default
        if backend_url != 'http://localhost:8000/events':
            send_event_cmd += f" --server-url {backend_url}"

        # Create hook configuration for this event
        hooks_config[event_type] = {
            "matcher": "",
            "commands": [
                script_name,
                send_event_cmd
            ]
        }

    # Build complete configuration object
    config = {
        "hooks": hooks_config,
        "statusLine": {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/status_lines/status_line_v6.py",
            "padding": 0
        }
    }

    return config


def main():
    """Main entry point."""
    args = parse_arguments()

    ccr_root = validate_ccr_project()
    print(f"✓ Running from CCR project: {ccr_root}")

    target_path = validate_target_path(args.target_repo_path)
    print(f"✓ Target path validated: {target_path}")

    print(f"Target repository: {target_path}")
    print(f"Source app name: {args.source_app}")
    print(f"Backend URL: {args.backend_url}")

    # Copy hook files to target repository
    copy_hook_files(ccr_root, target_path)

    # Load existing settings.json if present
    existing_settings = load_settings(target_path)
    if existing_settings:
        print("✓ Loaded existing settings.json")
    else:
        print("✓ No existing settings.json (will create new)")

    # Build CCR hooks configuration
    ccr_config = build_ccr_hooks_config(args.source_app, args.backend_url)
    print(f"✓ Built CCR hooks configuration for '{args.source_app}'")

    return 0


if __name__ == '__main__':
    sys.exit(main())