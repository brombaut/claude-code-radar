import { useState, useEffect, useRef } from 'react'
import type { ClaudeEvent } from '../hooks/useEventStream'
import { getSessionColor } from '../utils/sessionColors'

interface EventStreamProps {
  events: ClaudeEvent[]
  maxEvents?: number
}

const EVENT_EMOJIS: Record<string, string> = {
  // Session lifecycle
  'SessionStart': '🚀',
  'SessionEnd': '🛑',
  'Stop': '⏹️',

  // User interaction
  'UserPromptSubmit': '💬',
  'AssistantMessage': '🤖',

  // Tool execution
  'PreToolUse': '🔧',
  'PostToolUse': '✅',
  'PostToolUseFailure': '❌',

  // Permissions & notifications
  'PermissionRequest': '🔐',
  'Notification': '🔔',

  // Subagents
  'SubagentStart': '🌱',
  'SubagentStop': '🔚',

  // System events
  'PreCompact': '🗜️',
}

const EVENT_COLORS: Record<string, string> = {
  // Legacy event types
  'model_request': '#58a6ff',
  'model_response': '#3fb950',
  'tool_invocation': '#f0883e',
  'tool_response': '#bc8cff',
  'error': '#f85149',
  'session_start': '#768390',
  'session_end': '#768390',

  // Session lifecycle
  'SessionStart': '#768390',      // Gray
  'SessionEnd': '#768390',        // Gray
  'Stop': '#ff9500',              // Bright orange (noticeable!)

  // User interaction
  'UserPromptSubmit': '#bc8cff',  // Purple
  'AssistantMessage': '#26d0ce',  // Bright teal (distinct from user purple)

  // Tool execution
  'PreToolUse': '#58a6ff',        // Blue
  'PostToolUse': '#3fb950',       // Green
  'PostToolUseFailure': '#f85149', // Red

  // Permissions & notifications
  'PermissionRequest': '#f0883e', // Orange
  'Notification': '#00d9ff',      // Bright cyan (noticeable!)

  // Subagents
  'SubagentStart': '#39d353',     // Bright green
  'SubagentStop': '#2ea043',      // Dark green

  // System events
  'PreCompact': '#d29922',        // Yellow/gold (warning)
}

export function EventStream({ events, maxEvents = 100 }: EventStreamProps) {
  const [filter, setFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)
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
    // Backend sends timestamps in milliseconds, so no need to multiply
    return new Date(ts).toLocaleTimeString()
  }

  function getEventColor(eventType: string): string {
    return EVENT_COLORS[eventType] || '#9ca3af'
  }

  function getEventEmoji(eventType: string): string {
    return EVENT_EMOJIS[eventType] || '📌'
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '500px',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-secondary)'
    }}>
      <div style={{
        padding: '1.25rem',
        borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-tertiary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            {isCollapsed ? '▶' : '▼'}
          </span>
          <h2 style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: '600',
            color: 'var(--text-primary)'
          }}>
            Event Stream
          </h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              cursor: 'pointer'
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
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Auto-scroll
        </label>
      </div>

      {!isCollapsed && (
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1rem'
          }}
        >
        {displayedEvents.length === 0 ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            {filter === 'all' ? 'No events yet...' : `No ${filter} events`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {displayedEvents.map((event) => {
              const eventColor = getEventColor(event.hook_event_type)
              const sessionColor = getSessionColor(event.session_id)

              return (
                <div
                  key={event.id}
                  style={{
                    padding: '1rem',
                    borderLeft: `5px solid ${eventColor}`,
                    background: `linear-gradient(to right, ${eventColor}60 0%, ${eventColor}60 8px, ${sessionColor.bg} 8px)`,
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    transition: 'background 0.2s'
                  }}
                >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{
                      fontWeight: '600',
                      color: getEventColor(event.hook_event_type)
                    }}>
                      {getEventEmoji(event.hook_event_type)} {event.hook_event_type}
                    </span>
                    {event.tool_name && (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        color: 'var(--accent-orange)'
                      }}>
                        {event.tool_name}
                      </span>
                    )}
                  </div>
                  <span style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem'
                  }}>
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>

                {event.summary && (
                  <div style={{
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                    lineHeight: '1.5'
                  }}>
                    {event.summary}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  flexWrap: 'wrap'
                }}>
                  <span>
                    Session: <span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>
                      {event.session_id.slice(0, 8)}
                    </span>
                  </span>
                  {event.source_app && (
                    <span>App: <span style={{ color: 'var(--text-primary)' }}>{event.source_app}</span></span>
                  )}
                  {event.model_name && (
                    <span>Model: <span style={{ color: 'var(--text-primary)' }}>{event.model_name}</span></span>
                  )}
                </div>

                {event.payload && Object.keys(event.payload).length > 0 && (
                  <details style={{ marginTop: '0.75rem' }}>
                    <summary style={{
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      userSelect: 'none'
                    }}>
                      View Payload
                    </summary>
                    <pre style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: '200px',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)'
                    }}>
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
      )}
    </div>
  )
}