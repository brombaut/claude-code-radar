import { useEffect, useState, useRef } from 'react'

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

export function useEventStream() {
  const [events, setEvents] = useState<ClaudeEvent[]>([])
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

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
      setEvents(prev => [event, ...prev])
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

  return { events, connected }
}