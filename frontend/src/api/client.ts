// Connect directly to backend - CORS is configured on backend
const API_BASE_URL = 'http://localhost:8000'

export interface Session {
  session_id: string
  source_app: string | null
  model_name: string | null
  last_event_type: string | null
  last_activity: number
  event_count: number
}

export interface SessionsResponse {
  sessions: Session[]
  count: number
}

export interface EventsResponse {
  events: any[]
  count: number
}

export interface ToolStats {
  tool_usage: Array<{
    tool_name: string
    count: number
  }>
  success_failure: {
    success?: number
    failure?: number
  }
}

export async function getActiveSessions(minutes: number = 60): Promise<SessionsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/active?minutes=${minutes}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.statusText}`)
  }
  return response.json()
}

export async function getEvents(
  limit: number = 100,
  sessionId?: string,
  eventType?: string
): Promise<EventsResponse> {
  const params = new URLSearchParams({ limit: limit.toString() })
  if (sessionId) params.append('session_id', sessionId)
  if (eventType) params.append('event_type', eventType)

  const response = await fetch(`${API_BASE_URL}/api/events?${params}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`)
  }
  return response.json()
}

export async function fetchToolStats(hours: number = 1): Promise<ToolStats> {
  const response = await fetch(`${API_BASE_URL}/api/tools/stats?hours=${hours}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch tool stats: ${response.statusText}`)
  }
  return response.json()
}

export interface TokenStats {
  totals: {
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
    cache_creation_tokens: number
    request_count: number
  }
  by_session: Array<{
    session_id: string
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
    cache_creation_tokens: number
    request_count: number
  }>
  time_series: Array<{
    hour_bucket: number
    input_tokens: number
    output_tokens: number
  }>
}

export async function fetchTokenStats(hours: number = 1): Promise<TokenStats> {
  const response = await fetch(`${API_BASE_URL}/api/tokens/stats?hours=${hours}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch token stats: ${response.statusText}`)
  }
  return response.json()
}