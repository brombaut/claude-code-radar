# Token Tracking Fix & Per-Session Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix token event timestamps so they reflect actual API call time, then add a per-session minute-level token chart to the Analytics tab.

**Architecture:** Three-layer fix: patch `send_event.py` to use the token's actual timestamp at ingestion, add a new `/api/tokens/sessions` backend endpoint with minute-level bucketing, then replace the static "By Session" table in `ToolAnalytics.tsx` with SVG mini-charts showing per-minute consumption.

**Tech Stack:** Python 3.11 (hooks/backend), FastAPI, SQLite with `json_extract`, React 19 + TypeScript, inline SVG charts (no charting library).

**Design doc:** `docs/plans/2026-02-18-token-tracking-design.md`

---

### Task 1: Fix token event timestamp in `send_event.py`

**Files:**
- Modify: `.claude/hooks/send_event.py:83-91` (the `event_data` construction block)

The event timestamp is currently set to `datetime.now()` for all events. For `TokenUsage` events the payload contains the actual API call time in `token_usage.timestamp` (ISO 8601, e.g. `"2026-02-17T14:06:19.240Z"`). We need to use that instead.

**Step 1: Locate the timestamp line**

Open `.claude/hooks/send_event.py`. Find this block around line 84–91:

```python
event_data = {
    'source_app': args.source_app,
    'session_id': session_id,
    'hook_event_type': args.event_type,
    'payload': input_data,
    'timestamp': int(datetime.now().timestamp() * 1000),
    'model_name': model_name
}
```

**Step 2: Replace the timestamp logic**

Replace the block above with:

```python
# Default timestamp: now
ts_ms = int(datetime.now().timestamp() * 1000)

# For TokenUsage events, use the actual API call time from the payload
if args.event_type == 'TokenUsage':
    ts_str = input_data.get('token_usage', {}).get('timestamp', '')
    if ts_str:
        dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
        ts_ms = int(dt.timestamp() * 1000)

event_data = {
    'source_app': args.source_app,
    'session_id': session_id,
    'hook_event_type': args.event_type,
    'payload': input_data,
    'timestamp': ts_ms,
    'model_name': model_name
}
```

Note: `datetime` is already imported at the top of `send_event.py` — no new imports needed.

**Step 3: Reset the database**

```bash
rm backend/events.db
```

Then restart the backend (it will recreate the schema on startup). Old data had wrong timestamps and is not worth keeping.

**Step 4: Verify with a quick sanity check**

Run the backend and trigger one Claude Code interaction, then check:

```bash
python3 -c "
import sqlite3, json
conn = sqlite3.connect('backend/events.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute(\"SELECT timestamp, payload FROM events WHERE hook_event_type='TokenUsage' LIMIT 3\")
for row in cur.fetchall():
    p = json.loads(row['payload'])
    actual_ts = p.get('token_usage', {}).get('timestamp', 'N/A')
    print('DB ts:', row['timestamp'], '  Payload ts:', actual_ts)
"
```

The DB `timestamp` (ms) should correspond to the same minute as the payload `timestamp` string.

**Step 5: Commit**

```bash
git add .claude/hooks/send_event.py
git commit -m "fix: use actual API call timestamp for TokenUsage events"
```

---

### Task 2: Add `get_token_series_by_session` to `backend/events.py`

**Files:**
- Modify: `backend/events.py` (append after `get_token_stats`)

This new function returns per-session, per-minute token usage for use in mini-charts.

**Step 1: Append the function to `backend/events.py`**

```python
def get_token_series_by_session(hours: float, session_id: str = None) -> list[dict]:
    """
    Returns per-session minute-level token time series.

    Each entry: { session_id, total_input, total_output, series: [{minute, input_tokens, output_tokens, cache_read_tokens}] }
    Ordered by total token usage descending.
    """
    with get_db() as conn:
        cutoff = int((time.time() - hours * 3600) * 1000)
        cursor = conn.cursor()

        session_filter = "AND session_id = ?" if session_id else ""
        params = [cutoff]
        if session_id:
            params.append(session_id)

        cursor.execute(f"""
            SELECT
                session_id,
                (timestamp / 60000) * 60000                                                          AS minute,
                COALESCE(SUM(json_extract(payload, '$.token_usage.input_tokens')), 0)                AS input_tokens,
                COALESCE(SUM(json_extract(payload, '$.token_usage.output_tokens')), 0)               AS output_tokens,
                COALESCE(SUM(json_extract(payload, '$.token_usage.cache_read_input_tokens')), 0)     AS cache_read_tokens
            FROM events
            WHERE timestamp > ? AND hook_event_type = 'TokenUsage' {session_filter}
            GROUP BY session_id, minute
            ORDER BY session_id, minute ASC
        """, params)

        rows = cursor.fetchall()

    # Group by session_id
    sessions: dict[str, dict] = {}
    for row in rows:
        sid = row['session_id']
        if sid not in sessions:
            sessions[sid] = {'session_id': sid, 'total_input': 0, 'total_output': 0, 'series': []}
        point = {
            'minute': row['minute'],
            'input_tokens': row['input_tokens'],
            'output_tokens': row['output_tokens'],
            'cache_read_tokens': row['cache_read_tokens'],
        }
        sessions[sid]['series'].append(point)
        sessions[sid]['total_input'] += row['input_tokens']
        sessions[sid]['total_output'] += row['output_tokens']

    return sorted(sessions.values(), key=lambda s: s['total_input'] + s['total_output'], reverse=True)
```

**Step 2: Verify it imports correctly**

```bash
cd backend && python3 -c "from events import get_token_series_by_session; print('ok')"
```

Expected: `ok`

**Step 3: Commit**

```bash
git add backend/events.py
git commit -m "feat: add get_token_series_by_session with minute-level bucketing"
```

---

### Task 3: Add `/api/tokens/sessions` route to `backend/main.py`

**Files:**
- Modify: `backend/main.py` (add import + new route after the existing `/api/tokens/stats` route)

**Step 1: Add the import**

Find this line in `main.py`:

```python
from events import save_event, get_events, get_active_sessions, get_tool_stats, get_token_stats
```

Replace with:

```python
from events import save_event, get_events, get_active_sessions, get_tool_stats, get_token_stats, get_token_series_by_session
```

**Step 2: Add the route**

After the existing `/api/tokens/stats` route, add:

```python
@app.get("/api/tokens/sessions")
def token_sessions(hours: float = 1, session_id: Optional[str] = None):
    """Get per-session minute-level token time series."""
    return {"sessions": get_token_series_by_session(hours, session_id)}
```

**Step 3: Smoke-test the endpoint**

With the backend running (`uvicorn main:app --reload`):

```bash
curl "http://localhost:8000/api/tokens/sessions?hours=1" | python3 -m json.tool | head -40
```

Expected: JSON with a `sessions` array. Each entry has `session_id`, `total_input`, `total_output`, `series`.

**Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: add /api/tokens/sessions endpoint for per-session minute charts"
```

---

### Task 4: Add `fetchTokenSeries` to `frontend/src/api/client.ts`

**Files:**
- Modify: `frontend/src/api/client.ts` (append after `fetchTokenStats`)

**Step 1: Add the interface and function**

Append to `client.ts`:

```typescript
export interface TokenSeriesPoint {
  minute: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
}

export interface SessionTokenSeries {
  session_id: string
  total_input: number
  total_output: number
  series: TokenSeriesPoint[]
}

export interface TokenSeriesResponse {
  sessions: SessionTokenSeries[]
}

export async function fetchTokenSeries(
  hours: number,
  sessionId?: string
): Promise<TokenSeriesResponse> {
  const params = new URLSearchParams({ hours: hours.toString() })
  if (sessionId) params.append('session_id', sessionId)
  const response = await fetch(`${API_BASE_URL}/api/tokens/sessions?${params}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch token series: ${response.statusText}`)
  }
  return response.json()
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -i error
```

Expected: no errors.

**Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add fetchTokenSeries API client function"
```

---

### Task 5: Add per-session mini-charts to `ToolAnalytics.tsx`

**Files:**
- Modify: `frontend/src/components/ToolAnalytics.tsx`

This is the main visual change. We add a `SessionTokenChart` sub-component (inline in the file) and update `ToolAnalytics` to:
1. Fetch `tokenSeries` from the new endpoint
2. Render a full-width chart when a single session is selected
3. Render a list of mini-charts when "all" or "project" is selected
4. Replace the current "By Session" table with the mini-charts

**Step 1: Add imports at the top of `ToolAnalytics.tsx`**

Add `fetchTokenSeries` and the new types to the existing import:

```typescript
import { type ToolStats, fetchToolStats, type TokenStats, fetchTokenStats, type SessionTokenSeries, fetchTokenSeries } from '../api/client'
```

**Step 2: Add the `SessionTokenChart` sub-component**

Add this above the `ToolAnalytics` function:

```typescript
function SessionTokenChart({ data, mini = false }: { data: SessionTokenSeries; mini?: boolean }) {
  const { session_id, total_input, total_output, series } = data
  const chartH = mini ? 48 : 80
  const maxVal = Math.max(...series.map(d => d.input_tokens + d.output_tokens), 1)
  const barW = mini ? 6 : Math.max(6, Math.floor(480 / Math.max(series.length, 1)) - 2)

  return (
    <div style={{
      padding: mini ? '0.5rem' : '0.75rem',
      backgroundColor: 'var(--bg-tertiary)',
      borderRadius: '6px',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '0.375rem',
      }}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: mini ? '0.65rem' : '0.75rem',
          color: 'var(--text-secondary)',
        }}>
          {session_id.slice(0, 8)}…
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent-blue)' }}>{total_input.toLocaleString()}</span>
          {' in · '}
          <span style={{ color: 'var(--accent-green)' }}>{total_output.toLocaleString()}</span>
          {' out'}
        </span>
      </div>
      {series.length === 0 ? (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.5rem' }}>
          no data
        </div>
      ) : (
        <svg
          width="100%"
          viewBox={`0 0 ${series.length * (barW + 2)} ${chartH}`}
          preserveAspectRatio="none"
          style={{ display: 'block', borderRadius: '3px' }}
        >
          {series.map((d, i) => {
            const total = d.input_tokens + d.output_tokens
            const totalH = (total / maxVal) * chartH
            const inputH = (d.input_tokens / maxVal) * chartH
            const outputH = totalH - inputH
            const x = i * (barW + 2)
            return (
              <g key={d.minute}>
                <rect x={x} y={chartH - inputH} width={barW} height={inputH} fill="var(--accent-blue)" opacity={0.7} />
                <rect x={x} y={chartH - totalH} width={barW} height={outputH} fill="var(--accent-green)" opacity={0.7} />
              </g>
            )
          })}
        </svg>
      )}
      {!mini && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
          <span><span style={{ color: 'var(--accent-blue)' }}>■</span> Input</span>
          <span><span style={{ color: 'var(--accent-green)' }}>■</span> Output</span>
          <span style={{ marginLeft: 'auto' }}>per minute</span>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Update `ToolAnalytics` to fetch and use token series**

In the `ToolAnalytics` function, add state for token series:

```typescript
const [tokenSeries, setTokenSeries] = useState<SessionTokenSeries[] | null>(null)
```

Update the `loadStats` function to also fetch token series. Find the existing `loadStats` function and replace it:

```typescript
async function loadStats() {
  try {
    setLoading(true)
    setError(null)
    const singleSessionId = sessionIds?.length === 1 ? sessionIds[0] : undefined
    const [toolData, tokenData, seriesData] = await Promise.all([
      fetchToolStats(timeframeHours),
      fetchTokenStats(timeframeHours),
      fetchTokenSeries(timeframeHours, singleSessionId),
    ])
    setStats(toolData)
    setTokenStats(tokenData)
    setTokenSeries(seriesData.sessions)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to fetch stats')
  } finally {
    setLoading(false)
  }
}
```

**Step 4: Replace the "By Session" table with mini-charts**

In the JSX, find the `{tokenStats.by_session.length > 0 && (` block (currently renders a table). Replace it with:

```tsx
{tokenSeries && tokenSeries.length > 0 && (
  <div>
    <div style={{
      fontSize: '0.65rem',
      color: 'var(--text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '0.5rem'
    }}>
      Per Session (per minute)
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {tokenSeries.map(s => (
        <SessionTokenChart
          key={s.session_id}
          data={s}
          mini={tokenSeries.length > 1}
        />
      ))}
    </div>
  </div>
)}
```

**Step 5: Verify frontend compiles and renders**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`, go to Analytics tab. You should see per-session mini-charts in the Token Analytics section. With a session selected in the sidebar, you should see a single larger chart.

**Step 6: Commit**

```bash
git add frontend/src/components/ToolAnalytics.tsx
git commit -m "feat: add per-session minute-level token charts to Analytics tab"
```

---

### Task 6: Close the issue

```bash
bd close claude_code_observability-cia
bd sync
```
