#!/usr/bin/env python3
import json
from pathlib import Path
from typing import List, Dict, Any, Optional


def get_token_usage(
    transcript_path: str,
    last_processed_request_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Extract per-API-call token usage from transcript.

    Groups transcript entries by requestId, takes the final entry's usage
    for each request (since usage accumulates across streaming chunks).

    Returns list of dicts:
        {
            "request_id": "req_...",
            "model": "claude-opus-4-6",
            "timestamp": "2026-...",
            "input_tokens": 3,
            "output_tokens": 199,
            "cache_creation_input_tokens": 264,
            "cache_read_input_tokens": 34004,
            "cache_creation_1h_tokens": 264,
            "cache_creation_5m_tokens": 0,
        }
    """
    if not Path(transcript_path).exists():
        return []

    request_usage: Dict[str, Dict[str, Any]] = {}
    request_order: List[str] = []
    found_last_processed = last_processed_request_id is None

    try:
        with open(transcript_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if entry.get('type') != 'assistant':
                    continue

                request_id = entry.get('requestId')
                if not request_id:
                    continue

                if not found_last_processed:
                    if request_id == last_processed_request_id:
                        found_last_processed = True
                    continue

                message = entry.get('message', {})
                usage = message.get('usage')
                if not usage:
                    continue

                cache_creation = usage.get('cache_creation', {})

                record = {
                    'request_id': request_id,
                    'model': message.get('model', ''),
                    'timestamp': entry.get('timestamp', ''),
                    'input_tokens': usage.get('input_tokens', 0),
                    'output_tokens': usage.get('output_tokens', 0),
                    'cache_creation_input_tokens': usage.get('cache_creation_input_tokens', 0),
                    'cache_read_input_tokens': usage.get('cache_read_input_tokens', 0),
                    'cache_creation_1h_tokens': cache_creation.get('ephemeral_1h_input_tokens', 0),
                    'cache_creation_5m_tokens': cache_creation.get('ephemeral_5m_input_tokens', 0),
                }

                if request_id not in request_usage:
                    request_order.append(request_id)
                request_usage[request_id] = record

    except Exception:
        return []

    return [request_usage[rid] for rid in request_order]


def get_last_processed_request_id(session_log_dir: Path) -> Optional[str]:
    state_file = session_log_dir / 'token_usage_state.json'
    if not state_file.exists():
        return None
    try:
        with open(state_file, 'r') as f:
            return json.load(f).get('last_processed_request_id')
    except Exception:
        return None


def update_last_processed_request_id(session_log_dir: Path, request_id: str) -> None:
    state_file = session_log_dir / 'token_usage_state.json'
    try:
        with open(state_file, 'w') as f:
            json.dump({'last_processed_request_id': request_id}, f)
    except Exception:
        pass
