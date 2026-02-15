import { useEffect, useState } from 'react'
import { getActiveSessions, type Session } from '../api/client'
import { getSessionColor } from '../utils/sessionColors'

interface SessionOverviewProps {
  timeframeHours?: number
}

export function SessionOverview({ timeframeHours = 1 }: SessionOverviewProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshInterval] = useState(5000) // 5 second refresh

  const fetchSessions = async () => {
    try {
      const minutes = Math.ceil(timeframeHours * 60)
      const response = await getActiveSessions(minutes)
      setSessions(response.sessions)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval, timeframeHours])

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  if (loading && sessions.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        Loading sessions...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: '1rem',
        color: '#dc2626',
        backgroundColor: '#fee2e2',
        borderRadius: '0.375rem'
      }}>
        Error: {error}
      </div>
    )
  }

  // Extract all session IDs for color assignment
  const allSessionIds = sessions.map(s => s.session_id)

  return (
    <div>
      <h2 style={{
        marginTop: 0,
        marginBottom: '1rem',
        color: 'var(--text-primary)'
      }}>
        Active Sessions
      </h2>
      {sessions.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)'
        }}>
          No active sessions in the selected timeframe
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem'
        }}>
          {sessions.map((session) => {
            const sessionColor = getSessionColor(session.session_id, allSessionIds)
            return (
              <div
                key={session.session_id}
                style={{
                  backgroundColor: sessionColor.bg,
                  borderRadius: '8px',
                  padding: '1.25rem',
                  border: '1px solid var(--border-color)',
                  transition: 'background-color 0.2s'
                }}
              >
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Session ID
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  wordBreak: 'break-all',
                  color: 'var(--accent-blue)'
                }}>
                  {session.session_id}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginTop: '1rem'
              }}>
                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.25rem'
                  }}>
                    Model
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'var(--text-primary)'
                  }}>
                    {session.model_name || 'Unknown'}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.25rem'
                  }}>
                    Events
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'var(--accent-green)'
                  }}>
                    {session.event_count}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.25rem'
                }}>
                  Last Activity
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)'
                }}>
                  {formatTimestamp(session.last_activity)}
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}