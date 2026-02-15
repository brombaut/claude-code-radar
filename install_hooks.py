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

    return 0


if __name__ == '__main__':
    sys.exit(main())