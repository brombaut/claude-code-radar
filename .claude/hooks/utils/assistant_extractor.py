#!/usr/bin/env python3
"""
Extract assistant text messages from Claude Code transcript files.
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional


def get_assistant_messages(
    transcript_path: str,
    last_processed_uuid: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Extract assistant text messages from transcript.

    Args:
        transcript_path: Path to the .jsonl transcript file
        last_processed_uuid: UUID of the last processed message (to avoid duplicates)

    Returns:
        List of assistant message dicts with structure:
        {
            "uuid": "...",
            "timestamp": "...",
            "text": "...",
            "model": "...",
            "message_id": "..."
        }
    """
    if not Path(transcript_path).exists():
        return []

    assistant_messages = []
    found_last_processed = last_processed_uuid is None

    try:
        with open(transcript_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)

                    # Skip until we find the last processed message
                    if not found_last_processed:
                        if entry.get('uuid') == last_processed_uuid:
                            found_last_processed = True
                        continue

                    # Look for assistant messages with text content
                    if entry.get('type') == 'assistant':
                        message = entry.get('message', {})
                        if message.get('role') == 'assistant':
                            content = message.get('content', [])

                            # Extract text from content blocks
                            text_parts = []
                            for block in content:
                                if isinstance(block, dict) and block.get('type') == 'text':
                                    text_parts.append(block.get('text', ''))

                            if text_parts:
                                assistant_messages.append({
                                    'uuid': entry.get('uuid'),
                                    'timestamp': entry.get('timestamp'),
                                    'text': '\n'.join(text_parts),
                                    'model': message.get('model'),
                                    'message_id': message.get('id')
                                })

                except json.JSONDecodeError:
                    continue

    except Exception:
        return []

    return assistant_messages


def get_last_processed_uuid(session_log_dir: Path) -> Optional[str]:
    """Get the UUID of the last processed assistant message."""
    state_file = session_log_dir / 'assistant_messages_state.json'

    if not state_file.exists():
        return None

    try:
        with open(state_file, 'r') as f:
            state = json.load(f)
            return state.get('last_processed_uuid')
    except Exception:
        return None


def update_last_processed_uuid(session_log_dir: Path, uuid: str) -> None:
    """Update the last processed assistant message UUID."""
    state_file = session_log_dir / 'assistant_messages_state.json'

    try:
        state = {'last_processed_uuid': uuid}
        with open(state_file, 'w') as f:
            json.dump(state, f)
    except Exception:
        pass
