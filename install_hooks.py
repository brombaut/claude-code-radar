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

    args = parser.parse_args()

    if not args.source_app or not args.source_app.strip():
        parser.error("--source-app cannot be empty")

    return args


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

    for event_type, (script_name, hook_args) in hook_configs.items():
        hook_cmd = f'uv run $CLAUDE_PROJECT_DIR/.claude/hooks/{script_name}'
        if hook_args:
            hook_cmd += f' {" ".join(hook_args)}'

        send_event_cmd = f'uv run $CLAUDE_PROJECT_DIR/.claude/hooks/send_event.py --source-app {source_app} --event-type {event_type}'

        extra_args = send_event_extras.get(event_type, [])
        if extra_args:
            send_event_cmd += f' {" ".join(extra_args)}'

        if backend_url != 'http://localhost:8000/events':
            send_event_cmd += f' --server-url {backend_url}'

        hooks_list = [
            {'type': 'command', 'command': hook_cmd},
            {'type': 'command', 'command': send_event_cmd}
        ]

        config['hooks'][event_type] = [
            {
                'matcher': '',
                'hooks': hooks_list
            }
        ]

    return config


def merge_settings(existing, ccr_config):
    merged = existing.copy()
    merged['statusLine'] = ccr_config['statusLine']

    if 'hooks' not in merged:
        merged['hooks'] = {}

    for event_type, ccr_event_config in ccr_config['hooks'].items():
        if event_type not in merged['hooks']:
            merged['hooks'][event_type] = ccr_event_config
        else:
            existing_event = merged['hooks'][event_type]
            ccr_hooks = ccr_event_config[0]['hooks']

            if existing_event and len(existing_event) > 0:
                target_matcher = existing_event[0]
                if 'hooks' not in target_matcher:
                    target_matcher['hooks'] = []
                target_matcher['hooks'].extend(ccr_hooks)

    return merged


def write_settings(target_path, merged_settings):
    settings_file = target_path / '.claude' / 'settings.json'
    try:
        settings_file.parent.mkdir(parents=True, exist_ok=True)
        with open(settings_file, 'w') as f:
            json.dump(merged_settings, f, indent=2)
        print("✓ Updated .claude/settings.json (merged with existing config)")
    except Exception as e:
        print(f"Error writing settings file: {e}", file=sys.stderr)
        sys.exit(3)


def main():
    """Main entry point."""
    args = parse_arguments()

    ccr_root = validate_ccr_project()
    print(f"✓ Running from CCR project: {ccr_root}")

    target_path = validate_target_path(args.target_repo_path)
    print(f"✓ Target path validated: {target_path}")

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

    # Merge CCR hooks with existing configuration
    merged_settings = merge_settings(existing_settings, ccr_config)
    print("✓ Merged CCR hooks with existing configuration")

    # Write merged settings to target
    write_settings(target_path, merged_settings)

    print("\nInstallation complete!\n")
    print("Next steps:")
    print(f"1. Start CCR backend: cd {ccr_root} && uvicorn backend.main:app")
    print(f"2. Start CCR frontend: cd {ccr_root}/frontend && npm run dev")
    print(f"3. Use Claude Code in {target_path} - events will appear in dashboard")

    return 0


if __name__ == '__main__':
    sys.exit(main())