import { useEventStream } from './hooks/useEventStream'
import { EventStream } from './components/EventStream'
import { SessionOverview } from './components/SessionOverview'

function App() {
  const { events, connected } = useEventStream()

  return (
    <div style={{
      padding: '2rem',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#fafafa'
    }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0' }}>Claude Code Observability</h1>
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          fontSize: '0.875rem'
        }}>
          <span>Connection: {connected ? '🟢 Connected' : '🔴 Disconnected'}</span>
          <span>Total Events: {events.length}</span>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <SessionOverview />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <EventStream events={events} />
      </div>
    </div>
  )
}

export default App