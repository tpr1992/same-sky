// lib/strokes.ts
import { Skia, SkPath } from '@shopify/react-native-skia'

export type StrokePoint = { x: number; y: number; t: number }

export type BuildStrokeOptions = {
  baseWidth: number            // e.g. BRUSH_SIZES[selectedBrushSize]
  minWidth?: number            // defaults: 0.7 * baseWidth
  maxWidth?: number            // defaults: 1.35 * baseWidth
  minDistance?: number         // px between kept points (default 3)
  tension?: number             // Catmull-Rom tension (0..1), default 0.5
  opacityRange?: [number, number] // [min,max], default [0.65, 0.92]
}

export type BuiltStroke = {
  path: SkPath
  width: number
  opacity: number
  variableWidthPaths?: { path: SkPath; width: number; opacity: number }[]
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const map = (v: number, in0: number, in1: number, out0: number, out1: number) =>
  out0 + clamp01((v - in0) / (in1 - in0)) * (out1 - out0)

/** centripetal Catmull-Rom → cubic Bézier (stable, no loops) */
function catmullRomToCubic(points: StrokePoint[], tension = 0.5) {
  const path = Skia.Path.Make()
  if (points.length === 0) return path
  if (points.length === 1) {
    path.moveTo(points[0].x, points[0].y)
    return path
  }

  // Duplicate endpoints for simple boundaries
  const pts = [points[0], ...points, points[points.length - 1]]
  path.moveTo(points[0].x, points[0].y)

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2]
    const d1 = Math.pow(Math.hypot(p1.x - p0.x, p1.y - p0.y), 0.5)
    const d2 = Math.pow(Math.hypot(p2.x - p1.x, p2.y - p1.y), 0.5)
    const d3 = Math.pow(Math.hypot(p3.x - p2.x, p3.y - p2.y), 0.5)

    const A = (2 * d1 + d2) || 1
    const B = (2 * d3 + d2) || 1

    const c1x = p1.x + (p2.x - p0.x) * (tension * d2 / A)
    const c1y = p1.y + (p2.y - p0.y) * (tension * d2 / A)
    const c2x = p2.x - (p3.x - p1.x) * (tension * d2 / B)
    const c2y = p2.y - (p3.y - p1.y) * (tension * d2 / B)

    path.cubicTo(c1x, c1y, c2x, c2y, p2.x, p2.y)
  }
  return path
}

/** Thin points to at least minDistance apart (keeps ends) */
function thin(points: StrokePoint[], minDistance: number) {
  if (points.length <= 2) return points
  const out: StrokePoint[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1]
    const b = points[i]
    const d2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    if (d2 >= minDistance * minDistance) out.push(b)
  }
  out.push(points[points.length - 1])
  return out
}

function calculateSegmentSpeeds(points: StrokePoint[]): number[] {
  if (points.length < 2) return [0]
  
  const speeds: number[] = []
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      // First point - use speed to next point
      if (points.length > 1) {
        const dt = Math.max(1, points[1].t - points[0].t)
        const dist = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
        speeds.push(dist / dt)
      } else {
        speeds.push(0)
      }
    } else {
      // Use speed from previous point
      const dt = Math.max(1, points[i].t - points[i-1].t)
      const dist = Math.hypot(points[i].x - points[i-1].x, points[i-1].y - points[i-1].y)
      speeds.push(dist / dt)
    }
  }
  return speeds
}

function createVariableWidthBrushStamps(points: StrokePoint[], speeds: number[], opts: BuildStrokeOptions): { path: SkPath; width: number; opacity: number }[] {
  const {
    baseWidth,
    minWidth = baseWidth * 0.7,
    maxWidth = baseWidth * 1.35,
    opacityRange = [0.65, 0.92]
  } = opts

  if (points.length === 0) return []

  const stamps: { path: SkPath; width: number; opacity: number }[] = []
  
  // Create overlapping circular brush stamps along the path
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const speed = speeds[i]
    
    // Map speed to width/opacity
    const width = Math.max(minWidth, Math.min(maxWidth, map(speed, 0.0, 1.6, maxWidth, minWidth)))
    const opacity = map(speed, 0.0, 1.6, opacityRange[1], opacityRange[0])
    
    // Create circular brush stamp
    const stampPath = Skia.Path.Make()
    stampPath.addCircle(point.x, point.y, width / 2)
    
    stamps.push({ path: stampPath, width, opacity })
  }
  
  return stamps
}

export function buildStroke(points: StrokePoint[], opts: BuildStrokeOptions): BuiltStroke {
  const {
    baseWidth,
    minWidth = baseWidth * 0.7,
    maxWidth = baseWidth * 1.35,
    minDistance = 3,
    tension = 0.5,
    opacityRange = [0.65, 0.92]
  } = opts

  // Ensure timestamps
  if (points.length && points[0].t == null) {
    console.warn('buildStroke: points missing timestamps; provide {x,y,t}.')
  }

  // Light thinning for stability
  const pts = thin(points, minDistance)

  // Build smooth path (for fallback/preview)
  const path = catmullRomToCubic(pts, tension)

  // Calculate speeds for each point
  const speeds = calculateSegmentSpeeds(pts)

  // Create variable width brush stamps
  const variableWidthPaths = createVariableWidthBrushStamps(pts, speeds, opts)

  // Calculate average values for fallback
  let avgSpeed = 0
  if (pts.length >= 2) {
    const lastIdx = pts.length - 1
    const dt = Math.max(1, pts[lastIdx].t - pts[lastIdx-1].t)
    const dist = Math.hypot(pts[lastIdx].x - pts[lastIdx-1].x, pts[lastIdx-1].y - pts[lastIdx-1].y)
    avgSpeed = dist / dt
  }

  const width = Math.max(minWidth, Math.min(maxWidth, map(avgSpeed, 0.0, 1.6, maxWidth, minWidth)))
  const opacity = map(avgSpeed, 0.0, 1.6, opacityRange[1], opacityRange[0])

  return { path, width, opacity, variableWidthPaths }
}