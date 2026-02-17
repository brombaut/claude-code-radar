# Token Analytics Design

**Date:** 2026-02-17
**Status:** Approved

## Problem

Token usage data is already captured via `TokenUsage` events emitted by the `Stop` hook (using `token_extractor.py`), stored in the `events` table as payload JSON. Nothing in the frontend surfaces this data. The analytics tab only shows tool usage counts and success/failure rates.

## Goal

Add a "Token Analytics" section to the existing analytics tab that shows:
1. Summary stat cards (totals across the timeframe)
2. A per-session breakdown table
3. A time-series chart of token usage over time

## Approach

**Option A (chosen):** Extend `ToolAnalytics.tsx` with a new collapsible Token Analytics section below the existing tool analytics. Add a single new backend endpoint. No new component files, no new dependencies.

## Data Source

`TokenUsage` events in the `events` table. Each event's `payload` JSON contains:

```json
{
  "token_usage": {
    "request_id": "req_...",
    "model": "claude-...",
    "timestamp": "2026-...",
    "input_tokens": 100,
    "output_tokens": 200,
    "cache_creation_input_tokens": 300,
    "cache_read_input_tokens": 400,
    "cache_creation_1h_tokens": 300,
    "cache_creation_5m_tokens": 0
  }
}
```

Fields are extracted via SQLite `json_extract`.

## Backend Changes

### `events.py` — new function `get_token_stats(hours: float)`

Returns a dict with three keys:

**`totals`**
```python
{
  "input_tokens": int,
  "output_tokens": int,
  "cache_read_tokens": int,
  "cache_creation_tokens": int,
  "request_count": int
}
```
Summed across all `TokenUsage` events in the timeframe. Cache hit rate is computed frontend-side as `cache_read / (input + cache_read)`.

**`by_session`**
```python
[
  {
    "session_id": str,
    "input_tokens": int,
    "output_tokens": int,
    "cache_read_tokens": int,
    "request_count": int
  },
  ...
]
```
Sorted by total tokens (input + output) descending. Top 10 sessions.

**`time_series`**
```python
[
  {
    "hour_bucket": int,   # Unix timestamp truncated to hour
    "input_tokens": int,
    "output_tokens": int
  },
  ...
]
```
One row per hour in the window, ordered ascending. Used for the chart.

### `main.py` — new endpoint

```
GET /api/tokens/stats?hours=N
```
Calls `get_token_stats(hours)` and returns the dict directly.

## Frontend Changes

### `api/client.ts`

New interface `TokenStats` matching the backend response shape. New `fetchTokenStats(hours)` function hitting `/api/tokens/stats`.

### `ToolAnalytics.tsx`

Below the existing tool usage section, add a new collapsible "Token Analytics" subsection with its own state. Three sub-sections:

1. **Summary cards** (same style as existing stat cards):
   - Total Input Tokens
   - Total Output Tokens
   - Cache Hit Rate (`cache_read / (input + cache_read)` × 100)
   - Total Requests

2. **Time-series chart** — pure SVG, no new dependencies. X-axis: hourly buckets. Y-axis: stacked input (blue) + output (green) bars. Sized to fit the panel width.

3. **Per-session table** — columns: Session ID (truncated), Input, Output, Cache Read, Requests. Sorted by total tokens.

Token data is fetched in the same `useEffect` as tool stats, refreshing every 30s.

## Non-Goals

- Cost estimation (model pricing varies and changes; out of scope for now)
- Sub-hour time resolution in the chart
- Filtering by session in the token view (the existing timeframe filter applies)
