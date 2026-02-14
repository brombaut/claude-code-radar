import { useEventStream } from './hooks/useEventStream'
import { EventStream } from './components/EventStream'
import { SessionOverview } from './components/SessionOverview'
import { ToolAnalytics } from './components/ToolAnalytics'

function App() {
  const { events, connected } = useEventStream()

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
            <strong style={{ color: 'var(--text-primary)' }}>{events.length}</strong> events
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        padding: '2rem',
        overflow: 'auto'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <SessionOverview />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <ToolAnalytics />
        </div>

        <div style={{ minHeight: '400px' }}>
          <EventStream events={events} />
        </div>
      </div>
    </div>
  )
}

export default App