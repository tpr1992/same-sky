import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { findNodeHandle, NativeModules, requireNativeComponent, ViewProps } from 'react-native'

type Tool = 'pencil' | 'pen' | 'marker' | 'fountainPen' | 'eraserVector' | 'eraserBitmap'

type Props = ViewProps & {
  tool?: Tool
  color?: string    // hex (#RRGGBB or #AARRGGBB)
  lineWidth?: number
  fingerEnabled?: boolean
  onBegin?: () => void
  onChange?: () => void
  onEnd?: () => void
}

const COMPONENT_NAME = 'RNPKCanvasView'
const MANAGER_NAME = 'RNPKCanvasViewManager'

const NativePK = requireNativeComponent<Props>(COMPONENT_NAME)

export type PKCanvasRef = {
  clear(): void
  undo(): void
  redo(): void
  setDrawingPolicy(policy: 'any' | 'pencilOnly'): void
  exportBase64(): Promise<string>
  exportBase64Snapshot(): Promise<string>
  exportDrawingData(): Promise<string>
  loadDrawingData(data: string): void
  testBridge(): void
}

export const PKCanvas = forwardRef<PKCanvasRef, Props>((props, ref) => {
  const innerRef = useRef<any>(null)
  const manager = (NativeModules as any)[MANAGER_NAME]

  const getTag = () => {
    const tag = findNodeHandle(innerRef.current)
    if (tag == null) {
      throw new Error('PKCanvas view not mounted yet')
    }
    return tag
  }

  const call = (method: string, args: any[] = []) => {
    if (!manager?.[method]) {
      console.warn(`PKCanvas: native method ${method} is not available on ${MANAGER_NAME}`)
      return
    }
    const tag = getTag()
    manager[method](tag, ...args)
  }

  const callPromise = (method: string, args: any[] = []) => {
    if (!manager?.[method]) {
      return Promise.reject(new Error(`PKCanvas: native method ${method} is not available on ${MANAGER_NAME}`))
    }
    const tag = getTag()
    return manager[method](tag, ...args)
  }

  useImperativeHandle(ref, () => ({
    clear: () => call('clear'),
    undo: () => call('undo'),
    redo: () => call('redo'),
    setDrawingPolicy: p => call('setDrawingPolicy', [p === 'pencilOnly' ? 'pencilOnly' : 'any']),
    exportBase64: () => callPromise('exportBase64'),
    exportBase64Snapshot: () => callPromise('exportBase64Snapshot'),
    exportDrawingData: () => callPromise('exportDrawingData'),
    loadDrawingData: data => call('loadDrawingData', [data]),
    testBridge: () => call('testBridge') // will no-op with a warning if not exposed natively
  }))

  return <NativePK ref={innerRef} {...props} />
})
