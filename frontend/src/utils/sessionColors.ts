const COLOR_FAMILIES = [
  { hueStart: 185, hueEnd: 250 },  // cool: teal → blue → indigo
  { hueStart: 350, hueEnd: 55 },   // warm: red → orange → yellow (wraps around 0)
  { hueStart: 265, hueEnd: 340 },  // purple-pink: violet → magenta → pink
  { hueStart: 85, hueEnd: 175 },   // green: lime → green → teal
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  return Math.abs(hash)
}


function lerpHue(start: number, end: number, t: number): number {
  if (start > end) {
    const range = (360 - start) + end
    return (start + range * t) % 360
  }
  return start + (end - start) * t
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

function buildColor(familyIndex: number, sessionId: string): { bg: string; border: string; raw: string } {
  const family = COLOR_FAMILIES[familyIndex]
  const sessionHash = hashString(sessionId)
  const hueT = (sessionHash % 1000) / 1000
  const hue = lerpHue(family.hueStart, family.hueEnd, hueT)

  const saturation = 60 + (sessionHash % 30)
  const lightness = 45 + ((sessionHash >> 8) % 25)

  const [r, g, b] = hslToRgb(hue, saturation, lightness)

  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.15)`,
    border: `rgba(${r}, ${g}, ${b}, 0.4)`,
    raw: `rgb(${r}, ${g}, ${b})`,
  }
}

export function getSessionColor(sessionId: string): { bg: string; border: string; raw: string } {
  const familyIndex = hashString(sessionId) % COLOR_FAMILIES.length
  return buildColor(familyIndex, sessionId)
}
