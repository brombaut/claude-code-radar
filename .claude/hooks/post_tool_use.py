#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import json
import os
import sys
import subprocess
from pathlib import Path
from utils.constants import ensure_session_log_dir
from utils.assistant_extractor import (
    get_assistant_messages,
    get_last_processed_uuid,
    update_last_processed_uuid
)

def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)

        # Extract fields
        session_id = input_data.get('session_id', 'unknown')
        tool_name = input_data.get('tool_name', '')
        tool_use_id = input_data.get('tool_use_id', '')
        tool_input = input_data.get('tool_input', {})
        tool_response = input_data.get('tool_response', {})
        is_mcp_tool = tool_name.startswith('mcp__')

        # Ensure session log directory exists
        log_dir = ensure_session_log_dir(session_id)
        log_path = log_dir / 'post_tool_use.json'

        # Read existing log data or initialize empty list
        if log_path.exists():
            with open(log_path, 'r') as f:
                try:
                    log_data = json.load(f)
                except (json.JSONDecodeError, ValueError):
                    log_data = []
        else:
            log_data = []

        # Build log entry with tool_use_id
        log_entry = {
            "tool_name": tool_name,
            "tool_use_id": tool_use_id,
            "session_id": session_id,
            "hook_event_name": input_data.get("hook_event_name", "PostToolUse"),
            "is_mcp_tool": is_mcp_tool,
        }

        # For MCP tools, log the server and tool parts
        if is_mcp_tool:
            parts = tool_name.split('__')
            if len(parts) >= 3:
                log_entry["mcp_server"] = parts[1]
                log_entry["mcp_tool_name"] = '__'.join(parts[2:])
            log_entry["input_keys"] = list(tool_input.keys())[:10]

        # Append log entry
        log_data.append(log_entry)

        # Write back to file with formatting
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)

        # Extract and send new assistant messages from transcript
        transcript_path = input_data.get('transcript_path')
        if transcript_path:
            try:
                # Get last processed message UUID
                last_uuid = get_last_processed_uuid(log_dir)

                # Extract new assistant messages
                new_messages = get_assistant_messages(transcript_path, last_uuid)

                # Send each new message to backend
                if new_messages:
                    script_dir = Path(__file__).parent
                    send_event_script = script_dir / 'send_event.py'

                    for msg in new_messages:
                        # Prepare event data for assistant message
                        event_payload = {
                            'session_id': session_id,
                            'transcript_path': transcript_path,
                            'hook_event_name': 'AssistantMessage',
                            'assistant_message': {
                                'uuid': msg['uuid'],
                                'timestamp': msg['timestamp'],
                                'text': msg['text'],
                                'model': msg['model'],
                                'message_id': msg['message_id']
                            }
                        }

                        # Send to backend via send_event.py
                        try:
                            result = subprocess.run(
                                [
                                    'uv', 'run', str(send_event_script),
                                    '--source-app', 'claude-code-observability',
                                    '--event-type', 'AssistantMessage'
                                ],
                                input=json.dumps(event_payload),
                                capture_output=True,
                                text=True,
                                timeout=2
                            )
                        except Exception:
                            pass

                    # Update last processed UUID
                    if new_messages:
                        update_last_processed_uuid(log_dir, new_messages[-1]['uuid'])

            except Exception:
                pass

        sys.exit(0)

    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Exit cleanly on any other error
        sys.exit(0)

if __name__ == '__main__':
    main()