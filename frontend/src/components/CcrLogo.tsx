import CcrLogoSvg from '../assets/ccr-logo.svg?react'

interface CcrLogoProps {
  width?: string
  height?: string
}

export function CcrLogo({ width = '6rem', height = '6rem' }: CcrLogoProps) {
  return <CcrLogoSvg width={width} height={height} />
}
