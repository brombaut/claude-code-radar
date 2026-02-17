import { useState, useEffect, Fragment } from 'react'
import { type ToolStats, fetchToolStats, type TokenStats, fetchTokenStats } from '../api/client'

interface ToolAnalyticsProps {
  timeframeHours?: number
  sessionIds?: string[]
}

export function ToolAnalytics({ timeframeHours = 1 }: ToolAnalyticsProps) {
  const [stats, setStats] = useState<ToolStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null)
  const [tokenCollapsed, setTokenCollapsed] = useState(false)
  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [timeframeHours])

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
                                  x={x} y={chartH - inputH}
                                  width={barW} height={inputH}
                                  fill="var(--accent-blue)" opacity={0.7}
                                />
                                <rect
                                  x={x} y={chartH - totalH}
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
                        {tokenStats.by_session.map(s => (
                          <Fragment key={s.session_id}>
                            <div style={{
                              fontFamily: 'monospace',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-secondary)',
                              fontSize: '0.7rem'
                            }}>
                              {s.session_id.slice(0, 8)}…
                            </div>
                            <div style={{ textAlign: 'right', color: 'var(--accent-blue)' }}>
                              {s.input_tokens.toLocaleString()}
                            </div>
                            <div style={{ textAlign: 'right', color: 'var(--accent-green)' }}>
                              {s.output_tokens.toLocaleString()}
                            </div>
                            <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {s.cache_read_tokens.toLocaleString()}
                            </div>
                            <div style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                              {s.request_count}
                            </div>
                          </Fragment>
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