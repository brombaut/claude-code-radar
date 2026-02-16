import { useState, useMemo } from 'react'
import { useEventStream } from './hooks/useEventStream'
import { EventStream } from './components/EventStream'
import { SessionSidebar } from './components/SessionSidebar'
import { ToolAnalytics } from './components/ToolAnalytics'
import { Timeline } from './components/Timeline'
import { CcrLogo } from './components/CcrLogo'

function App() {
  const [timeframeHours, setTimeframeHours] = useState(5 / 60) // 5 minutes default
  const [selectedFilter, setSelectedFilter] = useState<{
    type: 'all' | 'project' | 'session'
    value: string
  }>({ type: 'all', value: 'all' })

  const { events, connected, loading } = useEventStream(timeframeHours)

  // Filter events based on selection
  const filteredEvents = useMemo(() => {
    if (selectedFilter.type === 'all') {
      return events
    }

    if (selectedFilter.type === 'session') {
      return events.filter(e => e.session_id === selectedFilter.value)
    }

    if (selectedFilter.type === 'project') {
      // Filter events by app (source_app field)
      return events.filter(e => e.source_app === selectedFilter.value)
    }

    return events
  }, [events, selectedFilter])

  // Get selected session IDs for tool analytics
  const selectedSessionIds = useMemo(() => {
    if (selectedFilter.type === 'all') {
      return undefined // All sessions
    }

    if (selectedFilter.type === 'session') {
      return [selectedFilter.value]
    }

    if (selectedFilter.type === 'project') {
      // Get all session IDs for this app
      const sessionIds = new Set<string>()
      events.forEach(e => {
        if (e.source_app === selectedFilter.value) {
          sessionIds.add(e.session_id)
        }
      })
      return Array.from(sessionIds)
    }

    return undefined
  }, [events, selectedFilter])

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0.5rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '2rem'
      }}>
        <h1 style={{
          margin: 0,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <CcrLogo width="6rem" height="6rem" />
          Claude Code Radar
        </h1>
        <div style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)'
        }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: connected ? 'var(--accent-green)' : 'var(--accent-red)'
            }}></span>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>{filteredEvents.length}</strong> events
            {selectedFilter.type !== 'all' && (
              <span style={{ opacity: 0.7, marginLeft: '0.5rem' }}>
                (filtered)
              </span>
            )}
          </span>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            Timeframe:
            <select
              value={timeframeHours}
              onChange={(e) => setTimeframeHours(Number(e.target.value))}
              style={{
                padding: '0.375rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              <option value={1 / 60}>Last 1 min</option>
              <option value={3 / 60}>Last 3 min</option>
              <option value={5 / 60}>Last 5 min</option>
              <option value={10 / 60}>Last 10 min</option>
              <option value={15 / 60}>Last 15 min</option>
            </select>
          </label>
        </div>
      </div>

      {/* Main layout: Sidebar + Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Sidebar */}
        <SessionSidebar
          timeframeHours={timeframeHours}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
        />

        {/* Main content area */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '2rem'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '400px',
              color: 'var(--text-secondary)',
              fontSize: '1rem'
            }}>
              Loading events...
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '2rem' }}>
                <ToolAnalytics
                  timeframeHours={timeframeHours}
                  sessionIds={selectedSessionIds}
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <Timeline events={filteredEvents} timeframeHours={timeframeHours} />
              </div>

              <div style={{ minHeight: '400px' }}>
                <EventStream events={filteredEvents} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App