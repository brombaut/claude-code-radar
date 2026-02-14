import { useEffect, useState, useRef } from 'react'
import { getEvents } from '../api/client'

export interface ClaudeEvent {
  id: number
  timestamp: number
  session_id: string
  hook_event_type: string
  source_app?: string
  model_name?: string
  tool_name?: string
  payload?: any
  summary?: string
}

export function useEventStream(timeframeHours: number = 1) {
  const [events, setEvents] = useState<ClaudeEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Load historical events on mount
  useEffect(() => {
    async function loadHistoricalEvents() {
      try {
        console.log(`Loading events from last ${timeframeHours} hour(s)`)
        const response = await getEvents(1000) // Fetch up to 1000 events

        // Filter events by timeframe
        const cutoffTime = Date.now() - (timeframeHours * 60 * 60 * 1000)
        const recentEvents = response.events.filter((e: ClaudeEvent) =>
          e.timestamp > cutoffTime
        )

        console.log(`Loaded ${recentEvents.length} historical events`)
        setEvents(recentEvents)
      } catch (error) {
        console.error('Failed to load historical events:', error)
      } finally {
        setLoading(false)
      }
    }

    loadHistoricalEvents()
  }, [timeframeHours])

  // Connect to SSE stream for live events
  useEffect(() => {
    const streamUrl = 'http://localhost:8000/stream'
    console.log('Attempting to connect to SSE at', streamUrl)
    const eventSource = new EventSource(streamUrl)
    eventSourceRef.current = eventSource

    console.log('EventSource created, readyState:', eventSource.readyState)

    eventSource.onopen = () => {
      console.log('✓ SSE connection opened successfully')
      setConnected(true)
    }

    eventSource.onmessage = (e) => {
      console.log('Received SSE message:', e.data)
      const event = JSON.parse(e.data) as ClaudeEvent

      // Add event if not already in list (prevent duplicates)
      setEvents(prev => {
        const exists = prev.some(e => e.id === event.id)
        return exists ? prev : [event, ...prev]
      })
    }

    eventSource.onerror = (error) => {
      console.error('✗ SSE connection error:', error)
      console.error('EventSource readyState:', eventSource.readyState)
      setConnected(false)
    }

    return () => {
      console.log('Closing SSE connection')
      eventSource.close()
      setConnected(false)
    }
  }, [])

  return { events, connected, loading }
}