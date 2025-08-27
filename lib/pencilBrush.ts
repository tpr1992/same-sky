// lib/pencilBrush.ts
import { Skia, type SkImage } from '@shopify/react-native-skia'

export type StrokePoint = { x: number; y: number; t: number }

export type PencilOptions = {
  baseSize: number
  minSize?: number
  maxSize?: number
  speedRange?: [number, number]
  opacityRange?: [number, number]
  spacing?: number
  jitter?: number
  hardness?: number
  grain?: number
}

export type PencilStamp = {
  x: number
  y: number
  size: number
  opacity: number
  angle: number
}

/** Build a soft graphite sprite once and reuse */
export function makePencilSprite(
  spriteSize = 128,
  opts: { hardness?: number; grain?: number } = {}
): SkImage | null {
  try {
    const { hardness = 0.55, grain = 0.08 } = opts
    const surface = Skia.Surface.Make(spriteSize, spriteSize)
    if (!surface) return null
    
    const c = surface.getCanvas()
    const cx = spriteSize / 2
    const cy = spriteSize / 2
    const r = spriteSize * 0.48

    // clear background
    c.clear(Skia.Color('rgba(0,0,0,0)'))

    // radial falloff using simpler approach
    const innerAlpha = hardness
    const p = Skia.Paint()
    p.setColor(Skia.Color(`rgba(43,43,43,${innerAlpha})`))
    p.setAntiAlias(true)
    
    // Create gradient effect with multiple circles
    for (let i = 0; i < 8; i++) {
      const radius = r * (1 - i / 8)
      const alpha = innerAlpha * (1 - Math.pow(i / 8, 2))
      p.setColor(Skia.Color(`rgba(43,43,43,${alpha})`))
      c.drawCircle(cx, cy, radius, p)
    }

    // speckle texture
    const dots = Math.floor(spriteSize * grain * 5)
    const dot = Skia.Paint()
    dot.setAntiAlias(true)
    for (let i = 0; i < dots; i++) {
      const rr = r * Math.sqrt(Math.random()) * 0.85
      const th = Math.random() * Math.PI * 2
      const x = cx + rr * Math.cos(th)
      const y = cy + rr * Math.sin(th)
      const a = 0.04 + Math.random() * 0.08
      dot.setColor(Skia.Color(`rgba(43,43,43,${a})`))
      c.drawCircle(x, y, 0.6 + Math.random() * 0.6, dot)
    }

    const image = surface.makeImageSnapshot()
    return image
  } catch (error) {
    console.error('Failed to create pencil sprite:', error)
    return null
  }
}

/** Evenly-spaced stamps between two points, with speed-mapped size/opacity + slight jitter */
export function stampsBetween(
  a: StrokePoint,
  b: StrokePoint,
  carry: number,
  opts: PencilOptions
): { stamps: PencilStamp[]; carry: number } {
  const {
    baseSize,
    minSize = baseSize * 0.75,
    maxSize = baseSize * 1.15,
    speedRange = [0, 1.6],
    opacityRange = [0.30, 0.70],
    spacing = 0.25,  // Reduced spacing for better coverage
    jitter = 0.02    // Reduced jitter for smoother appearance
  } = opts

  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return { stamps: [], carry }

  const step = baseSize * spacing
  let d = carry
  const ux = dx / dist
  const uy = dy / dist
  const stamps: PencilStamp[] = []

  // Pre-calculate values outside loop for performance
  const dt = Math.max(1, b.t - a.t)
  const v = dist / dt
  const size = lerpClamp(v, speedRange, [maxSize, minSize])
  const opacity = clamp01(lerp(v, speedRange, opacityRange))
  const j = size * jitter
  const baseAngle = Math.atan2(dy, dx)

  while (d + step <= dist) {
    d += step
    const x = a.x + ux * d
    const y = a.y + uy * d

    // Apply minimal jitter for performance
    const jitterX = (Math.random() * 2 - 1) * j
    const jitterY = (Math.random() * 2 - 1) * j
    const angle = baseAngle + (Math.random() - 0.5) * 0.08
    
    stamps.push({ 
      x: x + jitterX, 
      y: y + jitterY, 
      size, 
      opacity, 
      angle 
    })
  }

  return { stamps, carry: d + step - dist }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (v: number, [a, b]: [number, number], [c, d]: [number, number]) =>
  c + ((v - a) / (b - a)) * (d - c)
const lerpClamp = (v: number, rng: [number, number], out: [number, number]) =>
  Math.max(Math.min(lerp(v, rng, out), Math.max(...out)), Math.min(...out))