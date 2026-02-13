import { useEventStream } from './hooks/useEventStream'

function App() {
  const { events, connected } = useEventStream()

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Claude Code Observability</h1>
      <p>Connection: {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      <p>Events received: {events.length}</p>
      <pre>{JSON.stringify(events.slice(0, 3), null, 2)}</pre>
    </div>
  )
}

export default App