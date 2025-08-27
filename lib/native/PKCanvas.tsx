import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { requireNativeComponent, findNodeHandle, NativeModules, ViewProps } from 'react-native'

type Tool = 'pencil' | 'pen' | 'marker' | 'eraserVector' | 'eraserBitmap'

type Props = ViewProps & {
  tool?: Tool
  color?: string    // hex (#RRGGBB or #AARRGGBB)
  lineWidth?: number
  fingerEnabled?: boolean
  onBegin?: () => void
  onChange?: () => void
  onEnd?: () => void
}

const NativePK = requireNativeComponent<Props>('RNPKCanvasView')

export type PKCanvasRef = {
  clear(): void
  undo(): void
  redo(): void
  setDrawingPolicy(policy: 'any' | 'pencilOnly'): void
  exportBase64(): Promise<string> // PNG base64
}

export const PKCanvas = forwardRef<PKCanvasRef, Props>((props, ref) => {
  const innerRef = useRef(null)

  useImperativeHandle(ref, () => ({
    clear: () => call('clear'),
    undo: () => call('undo'),
    redo: () => call('redo'),
    setDrawingPolicy: (p) => call('setDrawingPolicy', [p === 'pencilOnly' ? 'pencilOnly' : 'any']),
    exportBase64: () => callPromise('exportBase64'),
  }))

  const call = (method: string, args: any[] = []) => {
    const tag = findNodeHandle(innerRef.current)
    // methods are on the manager module, pass reactTag
    ;(NativeModules as any).RNPKCanvasViewManager[method](tag, ...args)
  }

  const callPromise = (method: string, args: any[] = []) => {
    const tag = findNodeHandle(innerRef.current)
    return (NativeModules as any).RNPKCanvasViewManager[method](tag, ...args)
  }

  return <NativePK ref={innerRef} {...props} />
})