import { useMemo, useState, useEffect } from 'react'
import type { ClaudeEvent } from '../hooks/useEventStream'

interface TimelineProps {
  events: ClaudeEvent[]
  timeframeHours: number
}

const EVENT_EMOJIS: Record<string, string> = {
  'SessionStart': '🚀',
  'SessionEnd': '🛑',
  'Stop': '⏸️',
  'UserPromptSubmit': '💬',
  'AssistantMessage': '🤖',
  'PreToolUse': '🔧',
  'PostToolUse': '✅',
  'PostToolUseFailure': '❌',
  'PermissionRequest': '🔐',
  'Notification': '🔔',
  'SubagentStart': '🌱',
  'SubagentStop': '🔚',
  'PreCompact': '🗜️',
}

const EVENT_COLORS: Record<string, string> = {
  'SessionStart': '#768390',
  'SessionEnd': '#768390',
  'Stop': '#ff9500',
  'UserPromptSubmit': '#bc8cff',
  'AssistantMessage': '#26d0ce',
  'PreToolUse': '#58a6ff',
  'PostToolUse': '#3fb950',
  'PostToolUseFailure': '#f85149',
  'PermissionRequest': '#f0883e',
  'Notification': '#00d9ff',
  'SubagentStart': '#39d353',
  'SubagentStop': '#2ea043',
  'PreCompact': '#d29922',
}

// Convert timestamp to horizontal position as percentage of timeline width
// More recent = closer to right (smaller percentage)
function getPositionPercentage(timestamp: number, now: number, timeframeMs: number): number {
  const ageInMs = now - timestamp
  const percentage = (ageInMs / timeframeMs) * 100
  return Math.min(percentage, 100) // Cap at 100%
}

// Generate a stable random vertical position for each event based on its ID
// Returns a percentage (0-100) of the timeline height
function getRandomVerticalPosition(eventId: string): number {
  // Simple hash function to get consistent random value from event ID
  let hash = 0
  for (let i = 0; i < eventId.length; i++) {
    hash = ((hash << 5) - hash) + eventId.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  // Convert hash to percentage between 20% and 80% (leave margins)
  return 20 + (Math.abs(hash) % 60)
}

export function Timeline({ events, timeframeHours }: TimelineProps) {
  const [now, setNow] = useState(Date.now())

  // Update 'now' every second to make events flow left
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Group events by session
  const sessionGroups = useMemo(() => {
    const groups = new Map<string, ClaudeEvent[]>()
    events.forEach(event => {
      if (!groups.has(event.session_id)) {
        groups.set(event.session_id, [])
      }
      groups.get(event.session_id)!.push(event)
    })
    return groups
  }, [events])

  if (sessionGroups.size === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        No events to display
      </div>
    )
  }

  const timeframeMs = timeframeHours * 60 * 60 * 1000

  // Format timeframe label (show minutes if < 1 hour)
  const timeframeLabel = timeframeHours < 1
    ? `${Math.round(timeframeHours * 60)}m`
    : `${timeframeHours}h`

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    }}>
      {Array.from(sessionGroups.entries()).map(([sessionId, sessionEvents]) => {

        return (
          <div
            key={sessionId}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              position: 'relative'
            }}
          >
            {/* Session header */}
            <div style={{
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Session
                </span>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                  marginTop: '0.25rem'
                }}>
                  {sessionId.slice(0, 12)}...
                </div>
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)'
              }}>
                {sessionEvents.length} events • {timeframeLabel} timeframe
              </div>
            </div>

            {/* Horizontal scrolling timeline */}
            <div style={{
              position: 'relative',
              height: '150px',
              overflowX: 'auto',
              overflowY: 'hidden',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)'
            }}>
              {/* Timeline container */}
              <div style={{
                position: 'relative',
                height: '100%',
                width: '100%',
                minWidth: '100%'
              }}>

                {/* "Now" indicator on the right */}
                <div style={{
                  position: 'absolute',
                  right: '0',
                  top: '0',
                  bottom: '0',
                  width: '2px',
                  backgroundColor: 'var(--accent-green)',
                  zIndex: 2
                }}>
                  <span style={{
                    position: 'absolute',
                    right: '0',
                    top: '0',
                    fontSize: '0.7rem',
                    color: 'var(--accent-green)',
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '0.25rem',
                    borderRadius: '3px',
                    whiteSpace: 'nowrap',
                    transform: 'translateX(100%)'
                  }}>
                    now
                  </span>
                </div>

                {/* Timeframe start indicator on the left */}
                <div style={{
                  position: 'absolute',
                  left: '0',
                  top: '0',
                  bottom: '0',
                  width: '2px',
                  backgroundColor: 'var(--text-secondary)',
                  opacity: 0.3,
                  zIndex: 2
                }}>
                  <span style={{
                    position: 'absolute',
                    left: '0',
                    bottom: '0',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '0.25rem',
                    borderRadius: '3px',
                    whiteSpace: 'nowrap',
                    transform: 'translateX(-100%)'
                  }}>
                    -{timeframeLabel}
                  </span>
                </div>

                {/* Events */}
                {sessionEvents.map((event) => {
                  const eventColor = EVENT_COLORS[event.hook_event_type] || '#9ca3af'
                  const emoji = EVENT_EMOJIS[event.hook_event_type] || '📌'
                  const positionPercent = getPositionPercentage(event.timestamp, now, timeframeMs)
                  const verticalPercent = getRandomVerticalPosition(String(event.id))

                  return (
                    <div
                      key={event.id}
                      style={{
                        position: 'absolute',
                        right: `${positionPercent}%`,
                        top: `${verticalPercent}%`,
                        transform: 'translate(50%, -50%)',
                        transition: 'right 1s linear',
                        zIndex: 1
                      }}
                      title={`${event.hook_event_type}${event.tool_name ? ` - ${event.tool_name}` : ''}`}
                    >
                      {/* Event icon */}
                      <div style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '50%',
                        backgroundColor: eventColor,
                        border: '2px solid var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        {emoji}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
