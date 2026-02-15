// Palette of distinct muted base colors
const SESSION_COLOR_PALETTE = [
  { name: 'blue', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)' },
  { name: 'green', bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)' },
  { name: 'purple', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)' },
  { name: 'orange', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.4)' },
  { name: 'red', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' },
  { name: 'teal', bg: 'rgba(20, 184, 166, 0.15)', border: 'rgba(20, 184, 166, 0.4)' },
  { name: 'pink', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.4)' },
  { name: 'yellow', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)' },
  { name: 'indigo', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.4)' },
  { name: 'cyan', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)' },
]

/**
 * Simple hash function to convert string to number
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Assign colors to all sessions, ensuring no duplicates.
 * Returns a map of sessionId -> color index.
 */
function assignSessionColors(sessionIds: string[]): Map<string, number> {
  const assignments = new Map<string, number>()
  const takenIndices = new Set<number>()

  // Sort session IDs by their hash to ensure stable assignment order
  const sortedSessions = [...sessionIds].sort((a, b) => {
    const hashA = hashString(a)
    const hashB = hashString(b)
    return hashA - hashB
  })

  for (const sessionId of sortedSessions) {
    const hash = hashString(sessionId)
    const preferredIndex = hash % SESSION_COLOR_PALETTE.length

    // Try preferred color first
    if (!takenIndices.has(preferredIndex)) {
      assignments.set(sessionId, preferredIndex)
      takenIndices.add(preferredIndex)
      continue
    }

    // Find next available color
    let assigned = false
    for (let i = 1; i < SESSION_COLOR_PALETTE.length; i++) {
      const index = (preferredIndex + i) % SESSION_COLOR_PALETTE.length
      if (!takenIndices.has(index)) {
        assignments.set(sessionId, index)
        takenIndices.add(index)
        assigned = true
        break
      }
    }

    // If all colors taken (10+ sessions), use preferred color anyway
    if (!assigned) {
      assignments.set(sessionId, preferredIndex)
    }
  }

  return assignments
}

/**
 * Get a consistent color from the palette for a session ID.
 * If other session IDs are provided, will avoid using colors already taken.
 */
export function getSessionColor(
  sessionId: string,
  allSessionIds: string[] = []
): { bg: string; border: string } {
  // If no other sessions provided, use simple hash-based assignment
  if (allSessionIds.length === 0) {
    const hash = hashString(sessionId)
    const index = hash % SESSION_COLOR_PALETTE.length
    return SESSION_COLOR_PALETTE[index]
  }

  // Compute global color assignments
  const assignments = assignSessionColors(allSessionIds)
  const colorIndex = assignments.get(sessionId) ?? hashString(sessionId) % SESSION_COLOR_PALETTE.length

  return SESSION_COLOR_PALETTE[colorIndex]
}
