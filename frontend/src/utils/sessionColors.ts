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
 * Get a consistent color from the palette for a session ID.
 */
export function getSessionColor(sessionId: string): { bg: string; border: string } {
  // Simple hash function to convert string to number
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = sessionId.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32bit integer
  }

  // Pick a color from the palette based on hash
  const index = Math.abs(hash) % SESSION_COLOR_PALETTE.length
  return SESSION_COLOR_PALETTE[index]
}
