// lib/strokeSegments.ts
import { Skia, SkPath } from '@shopify/react-native-skia'

export type StrokePoint = { x: number; y: number; t: number }

export type SegOpts = {
  baseWidth: number
  minWidth?: number
  maxWidth?: number
  tension?: number         // 0.45–0.6 feels good
  speedRange?: [number, number] // px/ms → map to width/opacity, default [0.0, 1.6]
  opacityRange?: [number, number] // default ink [0.65, 0.92], pencil [0.35, 0.7]
}

export type StrokeSegment = {
  path: SkPath
  width: number
  opacity: number
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const map = (v: number, a: number, b: number, c: number, d: number) =>
  c + clamp01((v - a) / (b - a)) * (d - c)

/**
 * Build ONE new cubic segment p1->p2 using Catmull-Rom controls from p0..p3.
 * Returns null until we have enough points to emit something stable.
 * This never rewrites old segments, so widths/opacity already drawn won't change.
 */
export function buildNextSegment(
  pts: StrokePoint[],
  opts: SegOpts
): StrokeSegment | null {
  const n = pts.length
  if (n < 2) {
    return null
  }

  const {
    baseWidth,
    minWidth = baseWidth * 0.7,
    maxWidth = baseWidth * 1.35,
    tension = 0.5,
    speedRange = [0.0, 1.6],
    opacityRange = [0.65, 0.92],
  } = opts

  // estimate speed on the latest leg
  const a = pts[n - 2]
  const b = pts[n - 1]
  const dt = Math.max(1, (b.t ?? 0) - (a.t ?? 0))
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const speed = dist / dt

  // map speed → width & opacity
  const width = Math.max(minWidth, Math.min(maxWidth,
    map(speed, speedRange[0], speedRange[1], maxWidth, minWidth)
  ))
  const opacity = map(speed, speedRange[0], speedRange[1], opacityRange[1], opacityRange[0])

  // when we only have 2–3 points, emit a tiny quad so you see something immediately
  if (n === 2) {
    const seg = Skia.Path.Make()
    seg.moveTo(a.x, a.y)
    // mid-point smoothing for early stage
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    seg.quadTo(a.x, a.y, mx, my)
    return { path: seg, width, opacity }
  }

  // From 4 points on, do Catmull-Rom p1->p2
  const p0 = pts[n - 3]
  const p1 = pts[n - 2]
  const p2 = pts[n - 1]
  const p3 = pts[n - 1] // duplicate last as fallback; better if caller provides p3 when available
  // If we have a true p3:
  if (n >= 4) {
    const _p0 = pts[n - 4]
    // reassign with true 0..3
    const q0 = _p0, q1 = p0, q2 = p1, q3 = p2
    const d1 = Math.pow(Math.hypot(q1.x - q0.x, q1.y - q0.y), 0.5) || 1
    const d2 = Math.pow(Math.hypot(q2.x - q1.x, q2.y - q1.y), 0.5) || 1
    const d3 = Math.pow(Math.hypot(q3.x - q2.x, q3.y - q2.y), 0.5) || 1
    const A = (2 * d1 + d2)
    const B = (2 * d3 + d2)
    const c1x = q1.x + (q2.x - q0.x) * (tension * d2 / A)
    const c1y = q1.y + (q2.y - q0.y) * (tension * d2 / A)
    const c2x = q2.x - (q3.x - q1.x) * (tension * d2 / B)
    const c2y = q2.y - (q3.y - q1.y) * (tension * d2 / B)

    const seg = Skia.Path.Make()
    seg.moveTo(q1.x, q1.y)
    seg.cubicTo(c1x, c1y, c2x, c2y, q2.x, q2.y)
    return { path: seg, width, opacity }
  }

  // fallback (should rarely hit)
  const seg = Skia.Path.Make()
  seg.moveTo(p1.x, p1.y)
  seg.lineTo(p2.x, p2.y)
  return { path: seg, width, opacity }
}