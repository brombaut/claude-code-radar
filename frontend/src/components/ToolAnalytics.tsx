import { useState, useEffect } from 'react'
import { type ToolStats, fetchToolStats } from '../api/client'

interface ToolAnalyticsProps {
  timeframeHours?: number
  sessionIds?: string[]
}

export function ToolAnalytics({ timeframeHours = 1, sessionIds }: ToolAnalyticsProps) {
  const [stats, setStats] = useState<ToolStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [timeframeHours])

  async function loadStats() {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchToolStats(timeframeHours)
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tool stats')
    } finally {
      setLoading(false)
    }
  }

  const totalUsage = stats?.tool_usage?.reduce((sum, tool) => sum + tool.count, 0) || 0
  const successCount = stats?.success_failure?.success || 0
  const failureCount = stats?.success_failure?.failure || 0
  const totalOutcomes = successCount + failureCount
  const successRate = totalOutcomes > 0 ? (successCount / totalOutcomes * 100).toFixed(1) : 0

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
        </>
      )}
    </div>
  )
}