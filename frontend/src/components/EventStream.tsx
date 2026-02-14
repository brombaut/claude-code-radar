import { useState, useEffect, useRef } from 'react'
import type { ClaudeEvent } from '../hooks/useEventStream'

interface EventStreamProps {
  events: ClaudeEvent[]
  maxEvents?: number
}

const EVENT_COLORS: Record<string, string> = {
  'model_request': '#3b82f6',
  'model_response': '#10b981',
  'tool_invocation': '#f59e0b',
  'tool_response': '#a855f7',
  'error': '#ef4444',
  'session_start': '#6b7280',
  'session_end': '#6b7280',
}

export function EventStream({ events, maxEvents = 100 }: EventStreamProps) {
  const [filter, setFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const eventTypes = Array.from(new Set(events.map(e => e.hook_event_type)))

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.hook_event_type === filter)

  const displayedEvents = filteredEvents.slice(0, maxEvents)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [events, autoScroll])

  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleTimeString()
  }

  function getEventColor(eventType: string): string {
    return EVENT_COLORS[eventType] || '#9ca3af'
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
            Event Stream
          </h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Events ({events.length})</option>
            {eventTypes.map(type => (
              <option key={type} value={type}>
                {type} ({events.filter(e => e.hook_event_type === type).length})
              </option>
            ))}
          </select>
        </div>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem'
        }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0.5rem'
        }}
      >
        {displayedEvents.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            {filter === 'all' ? 'No events yet...' : `No ${filter} events`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {displayedEvents.map((event) => (
              <div
                key={event.id}
                style={{
                  padding: '0.75rem',
                  borderLeft: `4px solid ${getEventColor(event.hook_event_type)}`,
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{
                      fontWeight: '600',
                      color: getEventColor(event.hook_event_type)
                    }}>
                      {event.hook_event_type}
                    </span>
                    {event.tool_name && (
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem'
                      }}>
                        {event.tool_name}
                      </span>
                    )}
                  </div>
                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>

                {event.summary && (
                  <div style={{ color: '#374151', marginBottom: '0.25rem' }}>
                    {event.summary}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  fontSize: '0.75rem',
                  color: '#6b7280'
                }}>
                  <span>Session: {event.session_id.slice(0, 8)}</span>
                  {event.source_app && <span>App: {event.source_app}</span>}
                  {event.model_name && <span>Model: {event.model_name}</span>}
                </div>

                {event.payload && Object.keys(event.payload).length > 0 && (
                  <details style={{ marginTop: '0.5rem' }}>
                    <summary style={{
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      color: '#6b7280'
                    }}>
                      Payload
                    </summary>
                    <pre style={{
                      marginTop: '0.25rem',
                      padding: '0.5rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: '200px'
                    }}>
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}