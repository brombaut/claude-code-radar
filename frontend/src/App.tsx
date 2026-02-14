import { useState } from 'react'
import { useEventStream } from './hooks/useEventStream'
import { EventStream } from './components/EventStream'
import { SessionOverview } from './components/SessionOverview'
import { ToolAnalytics } from './components/ToolAnalytics'

function App() {
  const [timeframeHours, setTimeframeHours] = useState(1)
  const { events, connected, loading } = useEventStream(timeframeHours)

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '1.5rem 2rem'
      }}>
        <h1 style={{
          margin: '0 0 0.75rem 0',
          color: 'var(--text-primary)'
        }}>
          Claude Code Radar
        </h1>
        <div style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap'
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
            <strong style={{ color: 'var(--text-primary)' }}>{events.length}</strong> events
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
              <option value={0.25}>Last 15 min</option>
              <option value={0.5}>Last 30 min</option>
              <option value={1}>Last hour</option>
              <option value={3}>Last 3 hours</option>
              <option value={6}>Last 6 hours</option>
              <option value={12}>Last 12 hours</option>
              <option value={24}>Last 24 hours</option>
            </select>
          </label>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        padding: '2rem',
        overflow: 'auto'
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
              <SessionOverview timeframeHours={timeframeHours} />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <ToolAnalytics timeframeHours={timeframeHours} />
            </div>

            <div style={{ minHeight: '400px' }}>
              <EventStream events={events} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App