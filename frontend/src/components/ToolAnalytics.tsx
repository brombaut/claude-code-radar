import { useState, useEffect } from 'react'
import { type ToolStats, fetchToolStats, type TokenStats, fetchTokenStats, type SessionTokenSeries, fetchTokenSeries } from '../api/client'
import { getSessionColor } from '../utils/sessionColors'

const CHART_PX = 120

function fmtTokens(n: number) {
  if (n >= 100000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function generateTimeMarkers(timeframeHours: number): Array<{ label: string; percent: number }> {
  const timeframeMinutes = timeframeHours * 60
  let intervalMinutes: number
  if (timeframeMinutes <= 5) intervalMinutes = 1
  else if (timeframeMinutes <= 15) intervalMinutes = 5
  else if (timeframeMinutes <= 30) intervalMinutes = 10
  else if (timeframeMinutes <= 60) intervalMinutes = 15
  else intervalMinutes = 30

  const markers: Array<{ label: string; percent: number }> = []
  for (let minutes = intervalMinutes; minutes < timeframeMinutes; minutes += intervalMinutes) {
    markers.push({ label: `${Math.round(minutes)}m`, percent: (minutes / timeframeMinutes) * 100 })
  }
  return markers
}

function SessionTokenChart({ data, now, timeframeHours }: { data: SessionTokenSeries; now: number; timeframeHours: number }) {
  const { session_id, total_input, total_output, series } = data
  const color = getSessionColor(session_id)

  const timeframeMs = timeframeHours * 60 * 60 * 1000
  const visibleSeries = series.filter(d => (now - d.minute) <= timeframeMs)

  const maxOutput = Math.max(...visibleSeries.map(d => d.output_tokens), 1)
  const maxInput = Math.max(...visibleSeries.map(d => d.input_tokens), 1)

  const PAD = 2
  const chartW = 480

  const toCoords = (getValue: (d: typeof series[0]) => number, maxVal: number) =>
    visibleSeries.map(d => ({
      x: chartW * (1 - (now - d.minute) / timeframeMs),
      y: PAD + (1 - getValue(d) / maxVal) * (CHART_PX - 2 * PAD),
    }))

  const outputCoords = toCoords(d => d.output_tokens, maxOutput)
  const inputCoords = toCoords(d => d.input_tokens, maxInput)
  const toPointsStr = (coords: { x: number; y: number }[]) => coords.map(c => `${c.x},${c.y}`).join(' ')
  const timeMarkers = generateTimeMarkers(timeframeHours)

  return (
    <div style={{
      padding: '0.25rem 0.375rem',
      backgroundColor: color.bg,
      borderRadius: '6px',
      border: `1px solid ${color.border}`,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '0.2rem',
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
          {session_id.slice(0, 8)}…
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent-blue)' }}>{total_input.toLocaleString()}</span>
          {' in · '}
          <span style={{ color: 'var(--accent-green)' }}>{total_output.toLocaleString()}</span>
          {' out'}
        </span>
      </div>
      {visibleSeries.length === 0 ? (
        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textAlign: 'center', height: `${CHART_PX}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>no data</div>
      ) : (
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'stretch' }}>
          {/* Left Y-axis (output tokens) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: `${CHART_PX}px`,
            fontSize: '0.5rem',
            color: 'var(--accent-green)',
            textAlign: 'right',
            flexShrink: 0,
            lineHeight: 1,
          }}>
            <span>{fmtTokens(maxOutput)}</span>
            <span>0</span>
          </div>
          {/* Chart area */}
          <div style={{ flex: 1, position: 'relative', height: `${CHART_PX}px` }}>
            {/* Time marker lines + labels */}
            {timeMarkers.map(marker => (
              <div
                key={marker.label}
                style={{
                  position: 'absolute',
                  right: `${marker.percent}%`,
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  backgroundColor: 'var(--text-primary)',
                  opacity: 0.15,
                  zIndex: 1,
                }}
              >
                <span style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  fontSize: '0.45rem',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  pointerEvents: 'none',
                }}>
                  {marker.label}
                </span>
              </div>
            ))}
            {/* "Now" line on right edge */}
            <div style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: 'var(--accent-green)',
              opacity: 0.5,
              zIndex: 1,
            }} />
            {/* Polylines SVG */}
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${chartW} ${CHART_PX}`}
              preserveAspectRatio="none"
              style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}
            >
              <polyline
                points={toPointsStr(outputCoords)}
                fill="none"
                stroke="var(--accent-green)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={toPointsStr(inputCoords)}
                fill="none"
                stroke="var(--accent-blue)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {outputCoords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--accent-green)" vectorEffect="non-scaling-stroke" />
              ))}
              {inputCoords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--accent-blue)" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
          </div>
          {/* Right Y-axis (input tokens) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: `${CHART_PX}px`,
            fontSize: '0.5rem',
            color: 'var(--accent-blue)',
            textAlign: 'left',
            flexShrink: 0,
            lineHeight: 1,
          }}>
            <span>{fmtTokens(maxInput)}</span>
            <span>0</span>
          </div>
        </div>
      )}
    </div>
  )
}

interface ToolAnalyticsProps {
  timeframeHours?: number
  sessionIds?: string[]
}

export function ToolAnalytics({ timeframeHours = 1, sessionIds }: ToolAnalyticsProps) {
  const [stats, setStats] = useState<ToolStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null)
  const [tokenSeries, setTokenSeries] = useState<SessionTokenSeries[] | null>(null)
  const [tokenCollapsed, setTokenCollapsed] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [timeframeHours])

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

  const totalUsage = stats?.tool_usage?.reduce((sum, tool) => sum + tool.count, 0) || 0
  const successCount = stats?.success_failure?.success || 0
  const failureCount = stats?.success_failure?.failure || 0
  const totalOutcomes = successCount + failureCount
  const successRate = totalOutcomes > 0 ? (successCount / totalOutcomes * 100).toFixed(1) : 0
  const totals = tokenStats?.totals
  const cacheHitRate = totals && (totals.input_tokens + totals.cache_read_tokens + totals.cache_creation_tokens) > 0
    ? (totals.cache_read_tokens / (totals.input_tokens + totals.cache_read_tokens + totals.cache_creation_tokens) * 100).toFixed(1)
    : '0.0'

  return (
    <div>

      {loading && !stats && (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: 'var(--text-secondary)'
        }}>
          Loading...
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: 'rgba(248, 81, 73, 0.1)',
          color: 'var(--accent-red)',
          borderRadius: '6px',
          fontSize: '0.875rem',
          border: '1px solid rgba(248, 81, 73, 0.3)'
        }}>
          {error}
        </div>
      )}

      {stats && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{
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
                Total Calls
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: 'var(--text-primary)'
              }}>
                {totalUsage.toLocaleString()}
              </div>
            </div>

            <div style={{
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
                Success Rate
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: 'var(--accent-green)'
              }}>
                {successRate}%
              </div>
            </div>

            <div style={{
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
                Successful
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: 'var(--accent-blue)'
              }}>
                {successCount.toLocaleString()}
              </div>
            </div>

            <div style={{
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
                Failed
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: 'var(--accent-red)'
              }}>
                {failureCount.toLocaleString()}
              </div>
            </div>
          </div>

          <div>
            <h4 style={{
              margin: '0 0 0.75rem 0',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Tool Usage Breakdown
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stats.tool_usage && stats.tool_usage.length > 0 ? (
                stats.tool_usage
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                  .map(tool => {
                    const percentage = totalUsage > 0 ? (tool.count / totalUsage * 100) : 0
                    return (
                      <div key={tool.tool_name} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <div style={{
                          flex: '0 0 140px',
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-primary)'
                        }}>
                          {tool.tool_name}
                        </div>
                        <div style={{
                          flex: 1,
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: '3px',
                          height: '18px',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: 'var(--accent-blue)',
                            transition: 'width 0.3s',
                            borderRadius: '3px'
                          }} />
                        </div>
                        <div style={{
                          flex: '0 0 80px',
                          textAlign: 'right',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)'
                        }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                            {tool.count}
                          </span>
                          {' '}({percentage.toFixed(1)}%)
                        </div>
                      </div>
                    )
                  })
              ) : (
                <div style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                  padding: '2rem'
                }}>
                  No tool usage data available
                </div>
              )}
            </div>
          </div>

          {tokenStats && (
            <div style={{ marginTop: '1.5rem' }}>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
                        {[...tokenSeries].sort((a, b) => a.session_id.localeCompare(b.session_id)).map(s => (
                          <SessionTokenChart
                            key={s.session_id}
                            data={s}
                            now={now}
                            timeframeHours={timeframeHours}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}