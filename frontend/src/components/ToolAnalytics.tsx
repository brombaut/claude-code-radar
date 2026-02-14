import { useState, useEffect } from 'react'
import { type ToolStats, fetchToolStats } from '../api/client'

const TIME_RANGES = [
  { label: 'Last 15 min', hours: 0.25 },
  { label: 'Last 30 min', hours: 0.5 },
  { label: 'Last 1 hour', hours: 1 },
  { label: 'Last 3 hours', hours: 3 },
  { label: 'Last 6 hours', hours: 6 },
  { label: 'Last 24 hours', hours: 24 }
]

export function ToolAnalytics() {
  const [stats, setStats] = useState<ToolStats | null>(null)
  const [selectedRange, setSelectedRange] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [selectedRange])

  async function loadStats() {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchToolStats(selectedRange)
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
    <div style={{
      padding: '1.5rem',
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{
          margin: 0,
          color: 'var(--text-primary)'
        }}>
          Tool Analytics
        </h3>
        <select
          value={selectedRange}
          onChange={(e) => setSelectedRange(Number(e.target.value))}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            fontSize: '0.875rem',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          {TIME_RANGES.map(range => (
            <option key={range.hours} value={range.hours}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

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
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Total Calls
              </div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: 'var(--text-primary)'
              }}>
                {totalUsage.toLocaleString()}
              </div>
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Success Rate
              </div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: 'var(--accent-green)'
              }}>
                {successRate}%
              </div>
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Successful
              </div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: 'var(--accent-blue)'
              }}>
                {successCount.toLocaleString()}
              </div>
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Failed
              </div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: 'var(--accent-red)'
              }}>
                {failureCount.toLocaleString()}
              </div>
            </div>
          </div>

          <div>
            <h4 style={{
              margin: '0 0 1rem 0',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Tool Usage Breakdown
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                        gap: '1rem'
                      }}>
                        <div style={{
                          flex: '0 0 180px',
                          fontSize: '0.875rem',
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
                          borderRadius: '4px',
                          height: '24px',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: 'var(--accent-blue)',
                            transition: 'width 0.3s',
                            borderRadius: '4px'
                          }} />
                        </div>
                        <div style={{
                          flex: '0 0 100px',
                          textAlign: 'right',
                          fontSize: '0.875rem',
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