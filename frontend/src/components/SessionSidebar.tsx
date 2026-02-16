import { useEffect, useState } from 'react'
import { getActiveSessions, getEvents, type Session } from '../api/client'
import { getSessionColor } from '../utils/sessionColors'

interface SessionsByApp {
  [appName: string]: Session[]
}

interface SessionSidebarProps {
  timeframeHours: number
  selectedFilter: { type: 'all' | 'project' | 'session'; value: string }
  onFilterChange: (filter: { type: 'all' | 'project' | 'session'; value: string }) => void
}

export function SessionSidebar({ timeframeHours, selectedFilter, onFilterChange }: SessionSidebarProps) {
  const [sessionsByApp, setSessionsByApp] = useState<SessionsByApp>({})
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSessionsWithApps() {
      try {
        const minutes = Math.ceil(timeframeHours * 60)
        const sessionsResponse = await getActiveSessions(minutes)

        // Get events for each session to extract app info
        const appMap: SessionsByApp = {}

        for (const session of sessionsResponse.sessions) {
          try {
            const eventsResponse = await getEvents(1, session.session_id)
            const event = eventsResponse.events[0]

            // Extract app name from source_app
            let appName = 'Unknown App'
            if (event?.source_app) {
              appName = event.source_app
            }

            if (!appMap[appName]) {
              appMap[appName] = []
            }
            appMap[appName].push(session)
          } catch {
            // If we can't get events for a session, put it in unknown
            if (!appMap['Unknown App']) {
              appMap['Unknown App'] = []
            }
            appMap['Unknown App'].push(session)
          }
        }

        setSessionsByApp(appMap)

        // Auto-expand all apps initially
        setExpandedApps(new Set(Object.keys(appMap)))
      } catch (error) {
        console.error('Failed to load sessions:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSessionsWithApps()
    const interval = setInterval(loadSessionsWithApps, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [timeframeHours])

  const toggleApp = (appName: string) => {
    const newExpanded = new Set(expandedApps)
    if (newExpanded.has(appName)) {
      newExpanded.delete(appName)
    } else {
      newExpanded.add(appName)
    }
    setExpandedApps(newExpanded)
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  if (loading) {
    return (
      <div style={{
        width: '300px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        padding: '1rem',
        color: 'var(--text-secondary)',
        textAlign: 'center'
      }}>
        Loading sessions...
      </div>
    )
  }

  const appNames = Object.keys(sessionsByApp).sort()

  // Extract all session IDs for color assignment
  const allSessionIds = appNames.flatMap(appName =>
    sessionsByApp[appName].map(session => session.session_id)
  )

  return (
    <div style={{
      width: '300px',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-tertiary)'
      }}>
        <h3 style={{
          margin: '0 0 0.75rem 0',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Sessions
        </h3>

        {/* All Sessions option */}
        <div
          onClick={() => onFilterChange({ type: 'all', value: 'all' })}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: selectedFilter.type === 'all' ? 'var(--bg-primary)' : 'transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: selectedFilter.type === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            border: selectedFilter.type === 'all' ? '1px solid var(--border-color)' : '1px solid transparent'
          }}
        >
          📊 All Sessions
        </div>
      </div>

      {/* Apps and Sessions List */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0.5rem'
      }}>
        {appNames.length === 0 ? (
          <div style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem'
          }}>
            No active sessions
          </div>
        ) : (
          appNames.map(appName => {
            const sessions = sessionsByApp[appName]
            const isExpanded = expandedApps.has(appName)
            const isAppSelected = selectedFilter.type === 'project' && selectedFilter.value === appName

            return (
              <div key={appName} style={{ marginBottom: '0.5rem' }}>
                {/* App Header */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => toggleApp(appName)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.5rem',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem'
                    }}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                  <div
                    onClick={() => onFilterChange({ type: 'project', value: appName })}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.75rem',
                      backgroundColor: isAppSelected ? 'var(--bg-primary)' : 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: isAppSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'all 0.2s',
                      border: isAppSelected ? '1px solid var(--border-color)' : '1px solid transparent'
                    }}
                  >
                    📱 {appName}
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>
                      ({sessions.length})
                    </span>
                  </div>
                </div>

                {/* Sessions under this app */}
                {isExpanded && (
                  <div style={{ marginLeft: '2rem', marginTop: '0.25rem' }}>
                    {[...sessions].sort((a, b) => a.session_id.localeCompare(b.session_id)).map(session => {
                      const sessionColor = getSessionColor(session.session_id, allSessionIds)
                      const isSelected = selectedFilter.type === 'session' && selectedFilter.value === session.session_id

                      // Show highlight if:
                      // 1. This specific session is selected
                      // 2. All sessions are selected
                      // 3. This session's project is selected
                      const shouldHighlight =
                        isSelected ||
                        selectedFilter.type === 'all' ||
                        (selectedFilter.type === 'project' && selectedFilter.value === appName)

                      return (
                        <div
                          key={session.session_id}
                          onClick={() => onFilterChange({ type: 'session', value: session.session_id })}
                          style={{
                            padding: '0.5rem 0.75rem',
                            marginBottom: '0.25rem',
                            backgroundColor: shouldHighlight ? sessionColor.bg : 'transparent',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            transition: 'all 0.2s',
                            border: shouldHighlight ? `1px solid ${sessionColor.border}` : '1px solid transparent'
                          }}
                        >
                          <div style={{
                            fontFamily: 'monospace',
                            color: 'var(--text-primary)',
                            marginBottom: '0.25rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {session.session_id}
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            color: 'var(--text-secondary)',
                            fontSize: '0.7rem'
                          }}>
                            <span>{formatTimestamp(session.last_activity)}</span>
                            <span>{session.event_count} events</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
