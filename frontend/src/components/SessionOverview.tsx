import { useEffect, useState } from 'react'
import { getActiveSessions, type Session } from '../api/client'

export function SessionOverview() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshInterval] = useState(5000) // 5 second refresh

  const fetchSessions = async () => {
    try {
      const response = await getActiveSessions(60)
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
  }, [refreshInterval])

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

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Active Sessions</h2>
      {sessions.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb'
        }}>
          No active sessions in the last 60 minutes
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem'
        }}>
          {sessions.map((session) => (
            <div
              key={session.session_id}
              style={{
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                padding: '1rem',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}
            >
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Session ID
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  wordBreak: 'break-all'
                }}>
                  {session.session_id}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                marginTop: '0.75rem'
              }}>
                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginBottom: '0.125rem'
                  }}>
                    Model
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    {session.model_name || 'Unknown'}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginBottom: '0.125rem'
                  }}>
                    Event Count
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    {session.event_count}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginBottom: '0.125rem'
                }}>
                  Last Activity
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  {formatTimestamp(session.last_activity)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}