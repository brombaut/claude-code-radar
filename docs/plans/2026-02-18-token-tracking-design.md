# Token Tracking & Per-Session Visualization Design

**Issue:** `claude_code_observability-cia`
**Date:** 2026-02-18

## Problem

Token events are timestamped with `datetime.now()` in `send_event.py` — i.e. when the hook ran — not when the API call actually happened. For `stop.py`, which batch-processes all remaining tokens at session end, every token from the session gets the same stop-hook timestamp even if the API calls happened 30 minutes earlier. The result: the time-series chart is misleading, showing spikes at session-end rather than actual consumption over time.

Secondary issue: time-series is bucketed by hour, but the default timeframe is 5 minutes — giving zero per-minute insight.

## Design

### 1. Fix: timestamp at ingestion

In `send_event.py`, when `hook_event_type == 'TokenUsage'`, parse `input_data['token_usage']['timestamp']` (ISO 8601) and use it as the event timestamp instead of `datetime.now()`:

```python
# For TokenUsage events, use the actual API call time
if args.event_type == 'TokenUsage' and 'token_usage' in input_data:
    ts_str = input_data['token_usage'].get('timestamp', '')
    if ts_str:
        from datetime import timezone
        dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
        event_data['timestamp'] = int(dt.timestamp() * 1000)
```

After deploying: wipe `events.db` (dev only) and let it repopulate.

### 2. Backend: new per-session time-series endpoint

**New function** `get_token_series_by_session(hours, session_id=None)` in `events.py`:
- Filters `TokenUsage` events by time window
- Groups by `(session_id, minute_bucket)` where `minute_bucket = (timestamp / 60000) * 60000`
- Returns list of `{ session_id, series: [{ minute, input_tokens, output_tokens, cache_read_tokens }] }`

**New route** in `main.py`:
```
GET /api/tokens/sessions?hours=N&session_id=X
```
`session_id` is optional — omit for all sessions. The existing `/api/tokens/stats` is unchanged.

### 3. Frontend: per-session mini-charts in Analytics tab

- Add `fetchTokenSeries(hours, sessionId?)` to `client.ts`
- `ToolAnalytics.tsx` fetches per-session series alongside existing stats
- **Single session selected**: full-width per-minute chart for that session
- **All / project selected**: scrollable list of mini-charts, one per session, each showing per-minute input+output bars, session ID header, and total token count
- Chart style: SVG bar charts matching the existing pattern
- Existing aggregate stats block (totals, cache hit rate) stays above the per-session charts
- The current "By Session" table is replaced by the mini-charts

## Data flow after fix

```
transcript.jsonl
  └─ token_extractor.py (per-request, incremental)
       └─ send_event.py --event-type TokenUsage
            timestamp = token_usage.timestamp (actual API call time)
            └─ POST /events → SQLite
                 └─ GET /api/tokens/sessions?hours=N
                      └─ ToolAnalytics.tsx → per-session SVG mini-charts
```

## Scope

- No schema changes (timestamp is already an INTEGER column)
- No changes to `token_extractor.py`, `post_tool_use.py`, or `stop.py`
- Wipe and repopulate `events.db` after deploying the timestamp fix
