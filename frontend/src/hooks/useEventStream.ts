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
    const eventSource = new EventSource('/stream')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setConnected(true)
      console.log('SSE connected')
    }

    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data) as ClaudeEvent
      setEvents(prev => [event, ...prev])
    }

    eventSource.onerror = () => {
      setConnected(false)
      console.error('SSE connection error')
    }

    return () => {
      eventSource.close()
      setConnected(false)
    }
  }, [])

  return { events, connected }
}