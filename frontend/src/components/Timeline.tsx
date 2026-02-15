import { useMemo, useState, useEffect } from 'react'
import type { ClaudeEvent } from '../hooks/useEventStream'
import { getSessionColor } from '../utils/sessionColors'

interface TimelineProps {
  events: ClaudeEvent[]
  timeframeHours: number
}

const EVENT_EMOJIS: Record<string, string> = {
  'SessionStart': '🚀',
  'SessionEnd': '🛑',
  'Stop': '⏹️',
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

// Generate a stable random vertical position for each event based on its ID and type
// Returns a percentage (0-100) of the timeline height
function getRandomVerticalPosition(eventId: string, eventType: string): number {
  // Combine event ID and type to ensure different event types get different positions
  const combined = `${eventId}-${eventType}`

  // Simple hash function to get consistent random value
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  // Convert hash to percentage between 20% and 80% (leave margins)
  return 20 + (Math.abs(hash) % 60)
}

// Identify pairs of PreToolUse and PostToolUse/PostToolUseFailure events
interface EventPair {
  preEvent: ClaudeEvent
  postEvent: ClaudeEvent
  verticalPosition: number
}

function identifyEventPairs(events: ClaudeEvent[]): Map<number, EventPair> {
  const pairs = new Map<number, EventPair>()
  const pendingPreEvents = new Map<string, ClaudeEvent>()

  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp)

  sortedEvents.forEach(event => {
    if (event.hook_event_type === 'PreToolUse' && event.tool_name) {
      // Store this PreToolUse event, waiting for its pair
      pendingPreEvents.set(event.tool_name, event)
    } else if ((event.hook_event_type === 'PostToolUse' || event.hook_event_type === 'PostToolUseFailure') && event.tool_name) {
      // Look for matching PreToolUse event
      const preEvent = pendingPreEvents.get(event.tool_name)
      if (preEvent) {
        // Found a pair! Use the PreToolUse event's position for both
        const verticalPosition = getRandomVerticalPosition(String(preEvent.id), preEvent.hook_event_type)
        pairs.set(preEvent.id, { preEvent, postEvent: event, verticalPosition })
        pairs.set(event.id, { preEvent, postEvent: event, verticalPosition })
        // Remove from pending
        pendingPreEvents.delete(event.tool_name)
      }
    }
  })

  return pairs
}

// Generate time markers for the timeline
function generateTimeMarkers(timeframeHours: number): Array<{ label: string; percent: number }> {
  const timeframeMinutes = timeframeHours * 60
  const markers: Array<{ label: string; percent: number }> = []

  // Determine interval based on timeframe
  let intervalMinutes: number
  if (timeframeMinutes <= 1) {
    intervalMinutes = 0.25 // 15 seconds
  } else if (timeframeMinutes <= 3) {
    intervalMinutes = 0.5 // 30 seconds
  } else if (timeframeMinutes <= 5) {
    intervalMinutes = 1 // 1 minute
  } else if (timeframeMinutes <= 10) {
    intervalMinutes = 2 // 2 minutes
  } else {
    intervalMinutes = 3 // 3 minutes
  }

  // Generate markers from 0 to timeframe
  for (let minutes = intervalMinutes; minutes < timeframeMinutes; minutes += intervalMinutes) {
    const percent = (minutes / timeframeMinutes) * 100
    const label = minutes < 1 ? `${Math.round(minutes * 60)}s` : `${Math.round(minutes)}m`
    markers.push({ label, percent })
  }

  return markers
}

export function Timeline({ events, timeframeHours }: TimelineProps) {
  const [now, setNow] = useState(Date.now())
  const [isCollapsed, setIsCollapsed] = useState(false)

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

  // Group sessions by app
  const appGroups = useMemo(() => {
    const groups = new Map<string, Map<string, ClaudeEvent[]>>()

    sessionGroups.forEach((sessionEvents, sessionId) => {
      // Get app name from first event
      const appName = sessionEvents[0]?.source_app || 'Unknown App'

      if (!groups.has(appName)) {
        groups.set(appName, new Map())
      }
      groups.get(appName)!.set(sessionId, sessionEvents)
    })

    return groups
  }, [sessionGroups])

  const timeMarkers = useMemo(() => generateTimeMarkers(timeframeHours), [timeframeHours])

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

  // Extract all session IDs for color assignment
  const allSessionIds = Array.from(sessionGroups.keys())

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          padding: '1rem 1.25rem',
          borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-tertiary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          userSelect: 'none'
        }}
      >
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {isCollapsed ? '▶' : '▼'}
        </span>
        <h2 style={{
          margin: 0,
          fontSize: '1.125rem',
          fontWeight: '600',
          color: 'var(--text-primary)'
        }}>
          Timeline
        </h2>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          padding: '1rem'
        }}>
        {Array.from(appGroups.entries())
        .sort(([appNameA], [appNameB]) => {
          // Sort by app name alpha-numerically
          return appNameA.localeCompare(appNameB)
        })
        .map(([appName, appSessions]) => (
          <div key={appName} style={{
            border: '2px solid var(--border-color)',
            borderRadius: '8px',
            padding: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.1)'
          }}>
            {/* App Group Header */}
            <div style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <span>📱</span>
              {appName}
              <span style={{ opacity: 0.6, fontWeight: 'normal' }}>
                ({appSessions.size} {appSessions.size === 1 ? 'session' : 'sessions'})
              </span>
            </div>

            {/* Sessions in this app */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Array.from(appSessions.entries())
            .sort(([sessionIdA], [sessionIdB]) => {
              // Sort by session ID alpha-numerically
              return sessionIdA.localeCompare(sessionIdB)
            })
            .map(([sessionId, sessionEvents]) => {
        // Filter out events older than the timeframe
        const filteredSessionEvents = sessionEvents.filter(event => {
          const ageInMs = now - event.timestamp
          return ageInMs <= timeframeMs
        })

        // Skip rendering if no events in timeframe
        if (filteredSessionEvents.length === 0) {
          return null
        }

        // Identify paired events
        const eventPairs = identifyEventPairs(filteredSessionEvents)
        const sessionColor = getSessionColor(sessionId, allSessionIds)

        return (
          <div
            key={sessionId}
            style={{
              backgroundColor: sessionColor.bg,
              borderRadius: '8px',
              border: `1px solid ${sessionColor.border}`,
              padding: '0.75rem',
              position: 'relative'
            }}
          >
            {/* Session header */}
            <div style={{
              marginBottom: '0.75rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.5rem',
                flex: 1,
                minWidth: 0
              }}>
                <span style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  flexShrink: 0
                }}>
                  Session
                </span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)'
                }}>
                  {sessionId}
                </span>
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                {filteredSessionEvents.length} events • {timeframeLabel}
              </div>
            </div>

            {/* Horizontal scrolling timeline */}
            <div style={{
              position: 'relative',
              height: '120px',
              overflowX: 'hidden',
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
                {/* Time markers */}
                {timeMarkers.map((marker, index) => (
                  <div
                    key={`marker-${index}`}
                    style={{
                      position: 'absolute',
                      right: `${marker.percent}%`,
                      top: 0,
                      bottom: 0,
                      width: '1px',
                      backgroundColor: 'var(--text-primary)',
                      opacity: 0.3,
                      zIndex: 0
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      right: '0',
                      bottom: '0',
                      fontSize: '0.7rem',
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      transform: 'translateX(50%)',
                      border: '1px solid var(--border-color)',
                      fontWeight: '500'
                    }}>
                      {marker.label} ago
                    </span>
                  </div>
                ))}

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

                {/* Connecting lines for paired events */}
                {Array.from(new Set(
                  Array.from(eventPairs.values()).map(pair => pair.preEvent.id)
                )).map(preEventId => {
                  const pair = eventPairs.get(preEventId)
                  if (!pair) return null

                  const prePositionPercent = getPositionPercentage(pair.preEvent.timestamp, now, timeframeMs)
                  const postPositionPercent = getPositionPercentage(pair.postEvent.timestamp, now, timeframeMs)
                  const verticalPercent = pair.verticalPosition

                  return (
                    <div
                      key={`line-${preEventId}`}
                      style={{
                        position: 'absolute',
                        right: `${postPositionPercent}%`,
                        top: `${verticalPercent}%`,
                        width: `${prePositionPercent - postPositionPercent}%`,
                        height: '2px',
                        backgroundColor: 'var(--accent-blue)',
                        opacity: 0.4,
                        transition: 'right 1s linear, width 1s linear',
                        zIndex: 0,
                        transformOrigin: 'right center'
                      }}
                    />
                  )
                })}

                {/* Events */}
                {filteredSessionEvents.map((event) => {
                  const eventColor = EVENT_COLORS[event.hook_event_type] || '#9ca3af'
                  const emoji = EVENT_EMOJIS[event.hook_event_type] || '📌'
                  const positionPercent = getPositionPercentage(event.timestamp, now, timeframeMs)

                  // Use paired vertical position if this event is part of a pair
                  const pair = eventPairs.get(event.id)
                  let verticalPercent = pair
                    ? pair.verticalPosition
                    : getRandomVerticalPosition(String(event.id), event.hook_event_type)

                  // Offset paired events vertically to prevent overlap
                  // PreToolUse goes above the line, Post goes below
                  let verticalOffset = 0
                  if (pair) {
                    if (event.hook_event_type === 'PreToolUse') {
                      verticalOffset = -20 // Move up
                    } else if (event.hook_event_type === 'PostToolUse' || event.hook_event_type === 'PostToolUseFailure') {
                      verticalOffset = 20 // Move down
                    }
                  }

                  return (
                    <div
                      key={event.id}
                      style={{
                        position: 'absolute',
                        right: `${positionPercent}%`,
                        top: `calc(${verticalPercent}% + ${verticalOffset}px)`,
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
          </div>
        ))}
        </div>
      )}
    </div>
  )
}
