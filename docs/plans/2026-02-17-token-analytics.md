# Token Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Token Analytics section to the analytics tab showing summary stats, per-session breakdown, and a time-series bar chart sourced from existing `TokenUsage` events in the DB.

**Architecture:** New `get_token_stats` query function extracts token fields from payload JSON via SQLite's `json_extract`, exposed via a new `/api/tokens/stats` endpoint. The existing `ToolAnalytics` component gains a second collapsible subsection fetching this data alongside its existing tool stats fetch. Chart is pure SVG, no new deps.

**Tech Stack:** Python/FastAPI (backend), TypeScript/React 19 (frontend), SQLite `json_extract` for payload parsing.

---

### Task 1: Add `get_token_stats` to `events.py`

**Files:**
- Modify: `backend/events.py` (append at end)

**Step 1: Add the function**

Append to `backend/events.py`:

```python
def get_token_stats(hours: float = 1) -> dict:
    """Get token usage statistics for last N hours."""
    with get_db() as conn:
        cutoff = int((time.time() - hours * 3600) * 1000)
        cursor = conn.cursor()

        # Overall totals
        cursor.execute("""
            SELECT
                COALESCE(SUM(json_extract(payload, '$.token_usage.input_tokens')), 0)            AS input_tokens,
                COALESCE(SUM(json_extract(payload, '$.token_usage.output_tokens')), 0)           AS output_tokens,
                COALESCE(SUM(json_extract(payload, '$.token_usage.cache_read_input_tokens')), 0) AS cache_read_tokens,
                COALESCE(SUM(json_extract(payload, '$.token_usage.cache_creation_input_tokens')), 0) AS cache_creation_tokens,
                COUNT(*) AS request_count
            FROM events
            WHERE timestamp > ? AND hook_event_type = 'TokenUsage'
        """, (cutoff,))
        totals = dict(cursor.fetchone())

        # Per-session breakdown (top 10 by total tokens)
        cursor.execute("""
            SELECT
                session_id,
                COALESCE(SUM(json_extract(payload, '$.token_usage.input_tokens')), 0)            AS input_tokens,
                COALESCE(SUM(json_extract(payload, '$.token_usage.output_tokens')), 0)           AS output_tokens,
                COALESCE(SUM(json_extract(payload, '$.token_usage.cache_read_input_tokens')), 0) AS cache_read_tokens,
                COUNT(*) AS request_count
            FROM events
            WHERE timestamp > ? AND hook_event_type = 'TokenUsage'
            GROUP BY session_id
            ORDER BY (input_tokens + output_tokens) DESC
            LIMIT 10
        """, (cutoff,))
        by_session = [dict(row) for row in cursor.fetchall()]

        # Hourly time series
        cursor.execute("""
            SELECT
                (timestamp / 3600000) * 3600000 AS hour_bucket,
                COALESCE(SUM(json_extract(payload, '$.token_usage.input_tokens')), 0)  AS input_tokens,
                COALESCE(SUM(json_extract(payload, '$.token_usage.output_tokens')), 0) AS output_tokens
            FROM events
            WHERE timestamp > ? AND hook_event_type = 'TokenUsage'
            GROUP BY hour_bucket
            ORDER BY hour_bucket ASC
        """, (cutoff,))
        time_series = [dict(row) for row in cursor.fetchall()]

        return {
            "totals": totals,
            "by_session": by_session,
            "time_series": time_series,
        }
```

**Step 2: Verify backend starts cleanly**

```bash
cd backend && source venv/bin/activate && python -c "from events import get_token_stats; print(get_token_stats(1))"
```
Expected: dict with keys `totals`, `by_session`, `time_series` (values may be empty/zero if no data).

**Step 3: Commit**

```bash
git add backend/events.py
git commit -m "feat: add get_token_stats query for TokenUsage events"
```

---

### Task 2: Expose `/api/tokens/stats` endpoint in `main.py`

**Files:**
- Modify: `backend/main.py`

**Step 1: Update the import line**

Find this line near the top of `backend/main.py`:
```python
from events import save_event, get_events, get_active_sessions, get_tool_stats
```
Change to:
```python
from events import save_event, get_events, get_active_sessions, get_tool_stats, get_token_stats
```

**Step 2: Add the endpoint**

After the `tool_statistics` route (around line 101), add:

```python
@app.get("/api/tokens/stats")
def token_statistics(hours: float = 1):
    """Get token usage statistics."""
    stats = get_token_stats(hours)
    return stats
```

**Step 3: Verify endpoint**

With uvicorn running (`uvicorn main:app --reload` in `backend/`):
```bash
curl "http://localhost:8000/api/tokens/stats?hours=24"
```
Expected: JSON with `totals`, `by_session`, `time_series` keys.

**Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: add /api/tokens/stats endpoint"
```

---

### Task 3: Add `TokenStats` type and fetch function to `client.ts`

**Files:**
- Modify: `frontend/src/api/client.ts`

**Step 1: Append the type and function**

Append to `frontend/src/api/client.ts`:

```typescript
export interface TokenStats {
  totals: {
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
    cache_creation_tokens: number
    request_count: number
  }
  by_session: Array<{
    session_id: string
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
    request_count: number
  }>
  time_series: Array<{
    hour_bucket: number
    input_tokens: number
    output_tokens: number
  }>
}

export async function fetchTokenStats(hours: number = 1): Promise<TokenStats> {
  const response = await fetch(`${API_BASE_URL}/api/tokens/stats?hours=${hours}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch token stats: ${response.statusText}`)
  }
  return response.json()
}
```

**Step 2: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add TokenStats type and fetchTokenStats to API client"
```

---

### Task 4: Add token analytics section to `ToolAnalytics.tsx`

**Files:**
- Modify: `frontend/src/components/ToolAnalytics.tsx`

**Context:** The component currently has one state variable `stats` for tool stats and fetches via `fetchToolStats`. We'll add parallel state for token data and render a new section below the existing tool breakdown.

**Step 1: Update imports at the top**

Change:
```typescript
import { type ToolStats, fetchToolStats } from '../api/client'
```
To:
```typescript
import { type ToolStats, fetchToolStats, type TokenStats, fetchTokenStats } from '../api/client'
```

**Step 2: Add token state inside the component**

After the existing state declarations (lines 10-13), add:
```typescript
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null)
  const [tokenCollapsed, setTokenCollapsed] = useState(false)
```

**Step 3: Fetch token stats alongside tool stats**

Replace the existing `loadStats` function:
```typescript
  async function loadStats() {
    try {
      setLoading(true)
      setError(null)
      const [toolData, tokenData] = await Promise.all([
        fetchToolStats(timeframeHours),
        fetchTokenStats(timeframeHours),
      ])
      setStats(toolData)
      setTokenStats(tokenData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats')
    } finally {
      setLoading(false)
    }
  }
```

**Step 4: Add helper variables after existing computed values**

After `const successRate = ...` (line 38), add:
```typescript
  const totals = tokenStats?.totals
  const cacheHitRate = totals && (totals.input_tokens + totals.cache_read_tokens) > 0
    ? (totals.cache_read_tokens / (totals.input_tokens + totals.cache_read_tokens) * 100).toFixed(1)
    : '0.0'
```

**Step 5: Add the token analytics section**

Inside the outer `{stats && ( <> ... </> )}` block, after the closing `</div>` of the tool usage breakdown section (before `</>`), add the entire token section below. Insert after line 289 (the `</div>` that closes the tool breakdown `<div>`):

```tsx
          {tokenStats && (
            <div style={{ marginTop: '1.5rem' }}>
              {/* Token Analytics sub-header */}
              <div
                onClick={() => setTokenCollapsed(!tokenCollapsed)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  marginBottom: tokenCollapsed ? 0 : '0.75rem',
                  userSelect: 'none'
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {tokenCollapsed ? '▶' : '▼'}
                </span>
                <h4 style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Token Analytics
                </h4>
              </div>

              {!tokenCollapsed && (
                <>
                  {/* Summary stat cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '1.25rem'
                  }}>
                    {[
                      { label: 'Input Tokens', value: (totals?.input_tokens ?? 0).toLocaleString(), color: 'var(--accent-blue)' },
                      { label: 'Output Tokens', value: (totals?.output_tokens ?? 0).toLocaleString(), color: 'var(--accent-green)' },
                      { label: 'Cache Hit Rate', value: `${cacheHitRate}%`, color: 'var(--accent-blue)' },
                      { label: 'API Requests', value: (totals?.request_count ?? 0).toLocaleString(), color: 'var(--text-primary)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{
                        padding: '0.75rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)'
                      }}>
                        <div style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.375rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          {label}
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Time-series bar chart */}
                  {tokenStats.time_series.length > 0 && (() => {
                    const series = tokenStats.time_series
                    const maxTotal = Math.max(...series.map(d => d.input_tokens + d.output_tokens), 1)
                    const chartH = 100
                    const barW = Math.max(4, Math.floor(560 / series.length) - 2)
                    return (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '0.5rem'
                        }}>
                          Tokens Over Time (hourly)
                        </div>
                        <svg
                          width="100%"
                          viewBox={`0 0 ${series.length * (barW + 2)} ${chartH}`}
                          preserveAspectRatio="none"
                          style={{ display: 'block', borderRadius: '4px', overflow: 'visible' }}
                        >
                          {series.map((d, i) => {
                            const total = d.input_tokens + d.output_tokens
                            const totalH = (total / maxTotal) * chartH
                            const inputH = (d.input_tokens / maxTotal) * chartH
                            const outputH = totalH - inputH
                            const x = i * (barW + 2)
                            return (
                              <g key={d.hour_bucket}>
                                <rect
                                  x={x} y={chartH - totalH}
                                  width={barW} height={inputH}
                                  fill="var(--accent-blue)" opacity={0.7}
                                />
                                <rect
                                  x={x} y={chartH - outputH}
                                  width={barW} height={outputH}
                                  fill="var(--accent-green)" opacity={0.7}
                                />
                              </g>
                            )
                          })}
                        </svg>
                        <div style={{
                          display: 'flex',
                          gap: '1rem',
                          marginTop: '0.375rem',
                          fontSize: '0.65rem',
                          color: 'var(--text-secondary)'
                        }}>
                          <span><span style={{ color: 'var(--accent-blue)' }}>■</span> Input</span>
                          <span><span style={{ color: 'var(--accent-green)' }}>■</span> Output</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Per-session breakdown */}
                  {tokenStats.by_session.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '0.5rem'
                      }}>
                        By Session
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr repeat(4, auto)',
                        gap: '0.25rem 0.75rem',
                        fontSize: '0.75rem'
                      }}>
                        {/* Header row */}
                        {['Session', 'Input', 'Output', 'Cache Read', 'Reqs'].map(h => (
                          <div key={h} style={{
                            color: 'var(--text-secondary)',
                            fontWeight: '600',
                            paddingBottom: '0.25rem',
                            borderBottom: '1px solid var(--border-color)'
                          }}>
                            {h}
                          </div>
                        ))}
                        {/* Data rows */}
                        {tokenStats.by_session.map(s => (
                          <>
                            <div key={`${s.session_id}-id`} style={{
                              fontFamily: 'monospace',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-secondary)',
                              fontSize: '0.7rem'
                            }}>
                              {s.session_id.slice(0, 8)}…
                            </div>
                            <div key={`${s.session_id}-in`} style={{ textAlign: 'right', color: 'var(--accent-blue)' }}>
                              {s.input_tokens.toLocaleString()}
                            </div>
                            <div key={`${s.session_id}-out`} style={{ textAlign: 'right', color: 'var(--accent-green)' }}>
                              {s.output_tokens.toLocaleString()}
                            </div>
                            <div key={`${s.session_id}-cache`} style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {s.cache_read_tokens.toLocaleString()}
                            </div>
                            <div key={`${s.session_id}-reqs`} style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                              {s.request_count}
                            </div>
                          </>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
```

**Step 6: Verify the frontend builds**

```bash
cd frontend && npm run build
```
Expected: build completes with no TypeScript errors.

**Step 7: Commit**

```bash
git add frontend/src/components/ToolAnalytics.tsx frontend/src/api/client.ts
git commit -m "feat: add token analytics section to ToolAnalytics"
```

---

### Task 5: Smoke test end-to-end

**Step 1: Start backend**

```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload
```

**Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

**Step 3: Open dashboard**

Navigate to `http://localhost:5173`, go to the Analytics tab.

**Step 4: Verify**

- Token Analytics subsection appears below Tool Usage Breakdown
- Summary cards render (may show zeros if no TokenUsage events in DB)
- Collapsing/expanding the Token Analytics subheader works
- Timeframe selector updates token data alongside tool data

**Step 5: Optional — populate test data**

If the DB has no `TokenUsage` events, run the test event script and check if it generates them:
```bash
python backend/test_events.py
```
If not, trigger a real Claude Code `Stop` event by ending a session — the `stop.py` hook will emit `TokenUsage` events for that transcript.
