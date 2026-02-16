interface CcrLogoProps {
  width?: string
  height?: string
}

export function CcrLogo({ width = '6rem', height = '6rem' }: CcrLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 600 600"
      width={width}
      height={height}
    >
      {/* Vinyl record body */}
      <circle cx="300" cy="300" r="260" fill="#2d2640"/>

      {/* Single vinyl groove */}
      <circle cx="300" cy="300" r="220" fill="none" stroke="#3a3155" strokeWidth="2"/>

      {/* Radar screen */}
      <circle cx="300" cy="300" r="175" fill="#1a3a42"/>

      {/* Two radar rings */}
      <circle cx="300" cy="300" r="85" fill="none" stroke="#5ec6b8" strokeWidth="1" opacity="0.3"/>
      <circle cx="300" cy="300" r="170" fill="none" stroke="#5ec6b8" strokeWidth="1" opacity="0.3"/>

      {/* Radar sweep line */}
      <line x1="300" y1="300" x2="390" y2="170" stroke="#5ec6b8" strokeWidth="2.5" opacity="0.6" strokeLinecap="round"/>

      {/* Blips */}
      <circle cx="235" cy="230" r="8" fill="#f7c948"/>
      <circle cx="370" cy="350" r="6" fill="#f7c948" opacity="0.75"/>
      <circle cx="255" cy="385" r="7" fill="#f7c948" opacity="0.85"/>

      {/* Center dot */}
      <circle cx="300" cy="300" r="5" fill="#5ec6b8"/>

      {/* CCR text */}
      <text fontFamily="'Monoton', cursive" fontSize="140" fill="#ffffff" stroke="#5ec6b8" strokeWidth="2">
        <tspan x="86" y="358">C</tspan>
        <tspan x="236" y="358">C</tspan>
        <tspan x="386" y="358">R</tspan>
      </text>
    </svg>
  )
}
