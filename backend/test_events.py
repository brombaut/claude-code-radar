#!/usr/bin/env python3

import json
import random
import time
import uuid
from typing import Dict, Any
import requests

SERVER_URL = "http://localhost:8000"

def check_health() -> bool:
    """Check if server is healthy."""
    try:
        response = requests.get(f"{SERVER_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Server is healthy")
            return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Server health check failed: {e}")
    return False

def generate_session_id() -> str:
    """Generate a realistic session ID."""
    return f"session_{uuid.uuid4().hex[:8]}"

def generate_tool_use_id() -> str:
    """Generate a realistic tool use ID."""
    return f"tool_use_{uuid.uuid4().hex[:12]}"

def current_timestamp() -> int:
    """Get current timestamp in milliseconds."""
    return int(time.time() * 1000)

def create_event(
    session_id: str,
    hook_event_type: str,
    **kwargs
) -> Dict[str, Any]:
    """Create a base event with common fields."""
    event = {
        "timestamp": current_timestamp(),
        "session_id": session_id,
        "hook_event_type": hook_event_type,
        "source_app": "test_script",
        "model_name": random.choice(["claude-opus-4-6", "claude-opus-4-1", "claude-3-5-sonnet"]),
        "payload": {
            "session_id": session_id,
            "timestamp": current_timestamp(),
            "hook_event_type": hook_event_type
        }
    }

    # Add any additional fields
    for key, value in kwargs.items():
        if key == "payload_extra":
            event["payload"].update(value)
        else:
            event[key] = value

    return event

def send_event(event: Dict[str, Any]) -> bool:
    """Send event to server."""
    try:
        response = requests.post(
            f"{SERVER_URL}/events",
            json=event,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        if response.status_code == 200:
            result = response.json()
            print(f"  ✓ Sent {event['hook_event_type']} (ID: {result.get('event_id', 'unknown')})")
            return True
        else:
            print(f"  ✗ Failed to send {event['hook_event_type']}: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Failed to send {event['hook_event_type']}: {e}")
    return False

def generate_session_events(session_id: str) -> list:
    """Generate a realistic sequence of events for a session."""
    events = []

    # SessionStart
    events.append(create_event(
        session_id=session_id,
        hook_event_type="SessionStart",
        payload_extra={
            "agent_type": "general-purpose",
            "source": "claude-code-terminal"
        }
    ))

    # UserPromptSubmit
    events.append(create_event(
        session_id=session_id,
        hook_event_type="UserPromptSubmit",
        summary="User asked to analyze a Python file",
        payload_extra={
            "prompt": "Can you analyze this Python file and suggest improvements?"
        }
    ))

    # Tool usage sequence
    tools = [
        ("Read", "Reading project file"),
        ("Grep", "Searching for patterns"),
        ("Edit", "Modifying code"),
        ("Bash", "Running tests"),
        ("Write", "Creating new file")
    ]

    for tool_name, summary in random.sample(tools, k=random.randint(2, 4)):
        tool_use_id = generate_tool_use_id()

        # PreToolUse
        events.append(create_event(
            session_id=session_id,
            hook_event_type="PreToolUse",
            tool_name=tool_name,
            summary=summary,
            payload_extra={
                "tool_name": tool_name,
                "tool_use_id": tool_use_id
            }
        ))

        # PostToolUse or PostToolUseFailure (90% success rate)
        if random.random() < 0.9:
            events.append(create_event(
                session_id=session_id,
                hook_event_type="PostToolUse",
                tool_name=tool_name,
                payload_extra={
                    "tool_name": tool_name,
                    "tool_use_id": tool_use_id,
                    "result": "Tool execution successful"
                }
            ))
        else:
            events.append(create_event(
                session_id=session_id,
                hook_event_type="PostToolUseFailure",
                tool_name=tool_name,
                payload_extra={
                    "tool_name": tool_name,
                    "tool_use_id": tool_use_id,
                    "error": f"Failed to execute {tool_name}: Permission denied",
                    "is_interrupt": False
                }
            ))

    # Optional: PermissionRequest (20% chance)
    if random.random() < 0.2:
        events.append(create_event(
            session_id=session_id,
            hook_event_type="PermissionRequest",
            tool_name="Bash",
            payload_extra={
                "tool_name": "Bash",
                "permission_suggestions": ["allow", "deny", "allow_once"]
            }
        ))

    # Optional: SubagentStart/Stop (30% chance)
    if random.random() < 0.3:
        agent_id = f"agent_{uuid.uuid4().hex[:8]}"
        events.append(create_event(
            session_id=session_id,
            hook_event_type="SubagentStart",
            payload_extra={
                "agent_id": agent_id,
                "agent_type": "code-reviewer"
            }
        ))

        # Some tool uses by subagent
        for _ in range(random.randint(1, 3)):
            tool_name = random.choice(["Read", "Grep", "Bash"])
            tool_use_id = generate_tool_use_id()
            events.append(create_event(
                session_id=session_id,
                hook_event_type="PreToolUse",
                tool_name=tool_name,
                payload_extra={
                    "tool_name": tool_name,
                    "tool_use_id": tool_use_id,
                    "agent_id": agent_id
                }
            ))
            events.append(create_event(
                session_id=session_id,
                hook_event_type="PostToolUse",
                tool_name=tool_name,
                payload_extra={
                    "tool_name": tool_name,
                    "tool_use_id": tool_use_id,
                    "agent_id": agent_id
                }
            ))

        events.append(create_event(
            session_id=session_id,
            hook_event_type="SubagentStop",
            payload_extra={
                "agent_id": agent_id,
                "agent_type": "code-reviewer",
                "stop_hook_active": True
            }
        ))

    # Optional: Notification (10% chance)
    if random.random() < 0.1:
        events.append(create_event(
            session_id=session_id,
            hook_event_type="Notification",
            summary="Task completed successfully",
            payload_extra={
                "notification_type": "success",
                "message": "All tests passed"
            }
        ))

    # TokenUsage events (2-4 per session, simulating per-API-call token tracking)
    for _ in range(random.randint(2, 4)):
        input_tok = random.randint(2000, 80000)
        output_tok = random.randint(200, 4000)
        cache_read = random.randint(0, 60000)
        cache_create = random.randint(0, 5000)
        events.append(create_event(
            session_id=session_id,
            hook_event_type="TokenUsage",
            payload_extra={
                "hook_event_name": "TokenUsage",
                "token_usage": {
                    "request_id": f"req_{uuid.uuid4().hex[:24]}",
                    "model": random.choice(["claude-opus-4-6", "claude-sonnet-4-5-20250929"]),
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                    "input_tokens": input_tok,
                    "output_tokens": output_tok,
                    "cache_creation_input_tokens": cache_create,
                    "cache_read_input_tokens": cache_read,
                    "cache_creation_1h_tokens": cache_create,
                    "cache_creation_5m_tokens": 0,
                }
            }
        ))

    # SessionEnd (80% chance for normal completion)
    if random.random() < 0.8:
        events.append(create_event(
            session_id=session_id,
            hook_event_type="SessionEnd",
            payload_extra={
                "reason": "user_exit"
            }
        ))

    return events

def main():
    """Main test script."""
    print("🚀 Claude Code Observability Test Event Generator")
    print("=" * 50)

    # Check server health
    if not check_health():
        print("\n⚠️  Please start the server first: uvicorn backend.main:app --reload")
        return

    print("\n📊 Generating test events...")

    # Generate multiple sessions
    num_sessions = 3
    total_events = 0
    successful_events = 0

    for i in range(num_sessions):
        session_id = generate_session_id()
        print(f"\n📁 Session {i+1}/{num_sessions}: {session_id}")

        events = generate_session_events(session_id)

        for event in events:
            # Add small delay to simulate real-time events
            time.sleep(random.uniform(0.1, 0.3))

            if send_event(event):
                successful_events += 1
            total_events += 1

        print(f"  Session complete: {len(events)} events")

    # Summary
    print("\n" + "=" * 50)
    print("📈 Test Summary:")
    print(f"  • Sessions created: {num_sessions}")
    print(f"  • Total events sent: {total_events}")
    print(f"  • Successful: {successful_events}/{total_events}")

    if successful_events == total_events:
        print("\n✨ All test events sent successfully!")
    else:
        print(f"\n⚠️  {total_events - successful_events} events failed to send")

    # Verify events were received
    try:
        response = requests.get(f"{SERVER_URL}/api/events?limit=10")
        if response.status_code == 200:
            result = response.json()
            print(f"\n🔍 Server reports {result['count']} recent events")
    except:
        pass

if __name__ == "__main__":
    main()