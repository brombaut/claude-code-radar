from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from database import init_db
from events import save_event, get_events, get_active_sessions, get_tool_stats
import asyncio
import json

app = FastAPI(title="Claude Code Radar API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SSE clients list (will be used for broadcasting)
sse_clients = []

class Event(BaseModel):
    timestamp: int
    session_id: str
    hook_event_type: str
    source_app: Optional[str] = None
    model_name: Optional[str] = None
    tool_name: Optional[str] = None
    payload: Optional[dict] = None
    summary: Optional[str] = None

@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def root():
    return {"message": "Claude Code Radar API"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/events")
async def receive_event(event: Event):
    """Receive event from Claude Code hooks."""
    try:
        # Save to database
        event_id = save_event(
            timestamp=event.timestamp,
            session_id=event.session_id,
            hook_event_type=event.hook_event_type,
            source_app=event.source_app,
            model_name=event.model_name,
            tool_name=event.tool_name,
            payload=event.payload,
            summary=event.summary
        )

        # Broadcast to SSE clients
        event_data = event.model_dump()
        event_data['id'] = event_id

        for queue in sse_clients:
            await queue.put(event_data)

        return {"status": "ok", "event_id": event_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/events")
def list_events(
    limit: int = 100,
    session_id: Optional[str] = None,
    event_type: Optional[str] = None
):
    """Get events with optional filters."""
    events = get_events(limit=limit, session_id=session_id, event_type=event_type)
    return {"events": events, "count": len(events)}

@app.get("/api/sessions/active")
def active_sessions(minutes: int = 60):
    """Get active sessions from last N minutes."""
    sessions = get_active_sessions(minutes=minutes)
    return {"sessions": sessions, "count": len(sessions)}

@app.get("/api/tools/stats")
def tool_statistics(hours: int = 1):
    """Get tool usage statistics."""
    stats = get_tool_stats(hours=hours)
    return stats

async def event_generator():
    """Generate SSE events for connected clients."""
    queue = asyncio.Queue()
    sse_clients.append(queue)

    try:
        while True:
            event_data = await queue.get()
            yield f"data: {json.dumps(event_data)}\n\n"
    except asyncio.CancelledError:
        sse_clients.remove(queue)

@app.get("/stream")
async def stream_events():
    """SSE endpoint for real-time event streaming."""
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )