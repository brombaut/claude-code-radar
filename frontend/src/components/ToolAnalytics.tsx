import { useState, useEffect } from 'react'
import { ToolStats, fetchToolStats } from '../api/client'

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
      padding: '1rem',
      backgroundColor: 'white',
      borderRadius: '4px',
      border: '1px solid #e0e0e0'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: 0 }}>Tool Analytics</h3>
        <select
          value={selectedRange}
          onChange={(e) => setSelectedRange(Number(e.target.value))}
          style={{
            padding: '0.25rem 0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '0.875rem'
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
        <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
          Loading...
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.5rem',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      {stats && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                Total Tool Calls
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                {totalUsage.toLocaleString()}
              </div>
            </div>

            <div style={{
              padding: '0.75rem',
              backgroundColor: '#e8f5e9',
              borderRadius: '4px'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                Success Rate
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2e7d32' }}>
                {successRate}%
              </div>
            </div>

            <div style={{
              padding: '0.75rem',
              backgroundColor: '#e3f2fd',
              borderRadius: '4px'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                Successful
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1565c0' }}>
                {successCount.toLocaleString()}
              </div>
            </div>

            <div style={{
              padding: '0.75rem',
              backgroundColor: '#ffebee',
              borderRadius: '4px'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                Failed
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#c62828' }}>
                {failureCount.toLocaleString()}
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#666' }}>
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
                        gap: '1rem'
                      }}>
                        <div style={{
                          flex: '0 0 150px',
                          fontSize: '0.875rem',
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {tool.tool_name}
                        </div>
                        <div style={{
                          flex: 1,
                          backgroundColor: '#f0f0f0',
                          borderRadius: '2px',
                          height: '20px',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: '#4caf50',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <div style={{
                          flex: '0 0 80px',
                          textAlign: 'right',
                          fontSize: '0.875rem'
                        }}>
                          {tool.count} ({percentage.toFixed(1)}%)
                        </div>
                      </div>
                    )
                  })
              ) : (
                <div style={{ color: '#666', fontSize: '0.875rem', textAlign: 'center' }}>
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