import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { Canvas, Path, Skia, SkPath, useCanvasRef } from '@shopify/react-native-skia'
import * as FileSystem from 'expo-file-system'
import { LinearGradient } from 'expo-linear-gradient'
import * as MediaLibrary from 'expo-media-library'
import { useRouter } from 'expo-router'
import React, { useRef, useState } from 'react'
import { Alert, Modal, Pressable, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { colors } from '../theme'

type BrushSizeKey = 'thin' | 'medium' | 'thick'

interface DrawingPath {
    path: SkPath
    color: string
    strokeWidth: number
    mode: 'draw' | 'erase'
    opacity?: number
    strokeVariation?: number
    blendMode?: 'srcOver' | 'multiply' | 'dstOut'
}

const BRUSH_SIZES: Record<BrushSizeKey, number> = {
    thin: 2,
    medium: 4,
    thick: 8
}

const ERASER_SIZES: Record<BrushSizeKey, number> = {
    thin: 12,
    medium: 20,
    thick: 32
}

const DRAW_COLORS = [
    '#2B2B2B', // Charcoal black
    '#4A4A4A', // Dark gray
    '#8B4513', // Saddle brown
    '#654321', // Dark brown
    '#B22222', // Fire brick red
    '#DC143C', // Crimson
    '#FF6347', // Tomato
    '#FF8C00', // Dark orange
    '#DAA520', // Goldenrod
    '#228B22', // Forest green
    '#2E8B57', // Sea green
    '#4682B4', // Steel blue
    '#483D8B', // Dark slate blue
    '#8B008B', // Dark magenta
    '#9932CC', // Dark orchid
    colors.ink,  // Keep the original ink color
]

// Natural ink simulation
const STROKE_VARIATION = 0.2   // Amount of width variation (0-1)
const OPACITY_VARIATION = 0.15 // Opacity variation for ink texture
const INK_SATURATION = 0.85    // Base ink opacity for natural look

export default function NotebookCanvas() {
    const router = useRouter()

    // finished strokes in React state (append on stroke end)
    const [paths, setPaths] = useState<DrawingPath[]>([])
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 })

    // live stroke in React state for immediate rendering
    const [currentPath, setCurrentPath] = useState<SkPath | null>(null)
    const pointsRef = useRef<{ x: number, y: number, t: number }[]>([])
    const canvasRef = useCanvasRef()

    const [selectedColor, setSelectedColor] = useState(colors.ink)
    const [selectedBrushSize, setSelectedBrushSize] = useState<BrushSizeKey>('medium')
    const [isErasing, setIsErasing] = useState(false)
    const [showClearModal, setShowClearModal] = useState(false)
    const [showSaveModal, setShowSaveModal] = useState(false)
    const [showColorWheel, setShowColorWheel] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [toolbarVisible, setToolbarVisible] = useState(true)
    
    // Color wheel rotation
    const wheelRotation = useSharedValue(0)
    
    // Undo/Redo state
    const [undoStack, setUndoStack] = useState<DrawingPath[][]>([])
    const [redoStack, setRedoStack] = useState<DrawingPath[][]>([])
    const canUndo = undoStack.length > 0
    const canRedo = redoStack.length > 0

    const beginStroke = (x: number, y: number) => {
        pointsRef.current = [{ x, y, t: Date.now() }]
        const path = Skia.Path.Make()
        path.moveTo(x, y)
        setCurrentPath(path)
    }

    const addPointSmooth = (x: number, y: number) => {
        const last = pointsRef.current[pointsRef.current.length - 1]
        const dx = x - last.x, dy = y - last.y
        if (dx * dx + dy * dy < 9) return

        const newPoint = { x, y, t: Date.now() }
        pointsRef.current.push(newPoint)

        // Update current path with smooth curve
        const path = Skia.Path.Make()
        if (pointsRef.current.length === 1) {
            path.moveTo(pointsRef.current[0].x, pointsRef.current[0].y)
        } else if (pointsRef.current.length === 2) {
            path.moveTo(pointsRef.current[0].x, pointsRef.current[0].y)
            path.lineTo(pointsRef.current[1].x, pointsRef.current[1].y)
        } else {
            // Use simple quadratic curves for smoothing
            path.moveTo(pointsRef.current[0].x, pointsRef.current[0].y)
            for (let i = 1; i < pointsRef.current.length - 1; i++) {
                const cp = pointsRef.current[i]
                const end = {
                    x: (pointsRef.current[i].x + pointsRef.current[i + 1].x) / 2,
                    y: (pointsRef.current[i].y + pointsRef.current[i + 1].y) / 2
                }
                path.quadTo(cp.x, cp.y, end.x, end.y)
            }
            // Final segment to last point
            const lastIdx = pointsRef.current.length - 1
            path.quadTo(
                pointsRef.current[lastIdx - 1].x,
                pointsRef.current[lastIdx - 1].y,
                pointsRef.current[lastIdx].x,
                pointsRef.current[lastIdx].y
            )
        }
        setCurrentPath(path)
    }

    const generateStrokeVariation = () => {
        const variation = (Math.random() - 0.5) * STROKE_VARIATION
        const opacity = INK_SATURATION + (Math.random() - 0.5) * OPACITY_VARIATION
        return { variation, opacity: Math.max(0.3, Math.min(1, opacity)) }
    }

    const createSoftEraserStrokes = (path: SkPath, centerRadius: number) => {
        // Create multiple eraser strokes with decreasing opacity for soft edge
        const layers = 5
        const strokes: DrawingPath[] = []
        
        for (let i = 0; i < layers; i++) {
            const layerRadius = centerRadius * (1 + i * 0.25)
            const layerOpacity = Math.max(0.1, 1 - (i * 0.18))
            
            strokes.push({
                path: path.copy(),
                color: '#FFFFFF',
                strokeWidth: layerRadius,
                mode: 'erase',
                opacity: layerOpacity,
                strokeVariation: 0,
                blendMode: 'dstOut'
            })
        }
        
        return strokes
    }

    const endStroke = () => {
        if (!currentPath || pointsRef.current.length === 0) return

        // Save current state for undo and clear redo stack
        setUndoStack(prev => [...prev, [...paths]])
        setRedoStack([]) // Clear redo stack when new action is performed

        if (isErasing) {
            // Commit eraser with soft multi-layer effect
            if (pointsRef.current.length === 1) {
                const [point] = pointsRef.current
                const finalPath = Skia.Path.Make()
                const radius = ERASER_SIZES[selectedBrushSize]
                finalPath.addCircle(point.x, point.y, radius / 2)
                const softEraserStrokes = createSoftEraserStrokes(finalPath, radius)
                setPaths(curr => [...curr, ...softEraserStrokes])
            } else {
                const softEraserStrokes = createSoftEraserStrokes(currentPath, ERASER_SIZES[selectedBrushSize])
                setPaths(curr => [...curr, ...softEraserStrokes])
            }
        } else {
            // Regular ink drawing stroke - create smooth gradient layers
            const baseStroke = BRUSH_SIZES[selectedBrushSize]
            const inkLayers: DrawingPath[] = []
            const { variation, opacity } = generateStrokeVariation()

            // Create multiple fine gradient layers for smooth transition
            const gradientLayers = 6 // Balanced number for performance and smoothness

            for (let i = 0; i < gradientLayers; i++) {
                const layerProgress = i / (gradientLayers - 1) // 0 to 1
                const layerWidth = baseStroke + variation + (layerProgress * baseStroke * 0.3)
                // Use exponential curve for more natural ink falloff
                const layerOpacity = opacity * (1 - Math.pow(layerProgress, 1.5) * 0.85)

                inkLayers.push({
                    path: currentPath.copy(),
                    color: selectedColor,
                    strokeWidth: layerWidth,
                    mode: 'draw',
                    opacity: Math.max(0.08, layerOpacity),
                    strokeVariation: variation,
                    blendMode: 'srcOver'
                })
            }

            setPaths(curr => [...curr, ...inkLayers])
        }

        setCurrentPath(null)
        pointsRef.current = []
    }

    // Animated style for color wheel rotation
    const wheelAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${wheelRotation.value}deg` }]
    }))

    // Auto-select color based on wheel position
    const updateSelectedColorFromWheel = (rotation: number) => {
        const baseColors = [
            '#FF0000','#FF4500','#FFD700','#32CD32','#00BFFF',
            '#9400D3','#FF1493','#8B4513','#2F2F2F', colors.ink
        ];
        const degreesPerColor = 360 / baseColors.length;

        // rotation increases with swipe; align zero to 12 o'clock and sample at right edge
        const offset = 90; // 12 o'clock -> 0, right edge is 0 degrees in our viewport
        const normalized = (((rotation + offset) % 360) + 360) % 360; // 0..360
        const idx = Math.round(normalized / degreesPerColor) % baseColors.length;

        const targetColor = baseColors[idx];
        if (targetColor && targetColor !== selectedColor) {
            setSelectedColor(targetColor);
            setIsErasing(false);
        }
    }

    // Color wheel gesture handler
    const colorWheelGesture = Gesture.Pan()
        .runOnJS(true)
        .onUpdate((event) => {
            const deltaY = event.translationY
            const newRotation = wheelRotation.value + deltaY * 0.5
            wheelRotation.value = withSpring(newRotation, {
                damping: 15,
                stiffness: 150,
                mass: 1,
            })
            runOnJS(updateSelectedColorFromWheel)(newRotation)
        })

    // Drawing gesture handlers on the JS thread to avoid runOnJS hops
    const pan = Gesture.Pan()
        .runOnJS(true)
        .minDistance(0) // Immediate activation
        .activateAfterLongPress(0) // No delay
        .shouldCancelWhenOutside(false)
        .onStart(e => beginStroke(e.x, e.y))
        .onUpdate(e => addPointSmooth(e.x, e.y))
        .onEnd(() => endStroke())
        .onFinalize(() => endStroke())

    const confirmClear = () => {
        setPaths([])
        setCurrentPath(null)
        pointsRef.current = []
        setUndoStack([]) // Clear undo history
        setRedoStack([]) // Clear redo history
        setShowClearModal(false)
    }

    const clearCanvas = () => {
        setShowClearModal(true)
    }

    const undo = () => {
        if (canUndo) {
            const currentState = [...paths]
            const previousState = undoStack[undoStack.length - 1]
            setPaths([...previousState])
            setUndoStack(prev => prev.slice(0, -1))
            setRedoStack(prev => [...prev, currentState])
        }
    }

    const redo = () => {
        if (canRedo) {
            const currentState = [...paths]
            const nextState = redoStack[redoStack.length - 1]
            setPaths([...nextState])
            setRedoStack(prev => prev.slice(0, -1))
            setUndoStack(prev => [...prev, currentState])
        }
    }

    const saveToCamera = async () => {
        if (isSaving) return
        
        setIsSaving(true)
        try {
            // Request permission to save to photo library
            const { status } = await MediaLibrary.requestPermissionsAsync()
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please allow access to your photo library to save drawings.')
                return
            }

            // Use the actual canvas dimensions, but ensure we have valid dimensions
            const canvasWidth = canvasDimensions.width || 400
            const canvasHeight = canvasDimensions.height || 600
            
            // Use higher resolution for crisp export (2x scale)
            const exportScale = 2
            const exportWidth = Math.floor(canvasWidth * exportScale)
            const exportHeight = Math.floor(canvasHeight * exportScale)
            
            // Create a new high-resolution canvas for export
            const exportCanvas = Skia.Surface.Make(exportWidth, exportHeight)
            
            if (!exportCanvas) {
                Alert.alert('Error', 'Could not create export canvas. Please try again.')
                return
            }

            const exportCanvasInstance = exportCanvas.getCanvas()
            
            // Scale the canvas to match our export resolution
            exportCanvasInstance.scale(exportScale, exportScale)
            
            // Fill with paper background color
            const backgroundPaint = Skia.Paint()
            backgroundPaint.setColor(Skia.Color('#fdfcf8')) // paper color
            exportCanvasInstance.drawPaint(backgroundPaint)
            
            // Draw notebook lines
            const linePaint = Skia.Paint()
            linePaint.setColor(Skia.Color('rgba(79,109,156,0.1)'))
            linePaint.setStrokeWidth(1)
            linePaint.setStyle(1) // stroke style
            
            const lineSpacing = 32 // approximately matches our CSS (15px margin + 1px line + 16px padding)
            const startY = 20 // top padding
            
            for (let i = 0; i < 25; i++) {
                const y = startY + (i * lineSpacing)
                if (y < canvasHeight - 20) { // bottom padding
                    exportCanvasInstance.drawLine(20, y, canvasWidth - 20, y, linePaint)
                }
            }
            
            // Draw all the existing paths
            paths.forEach(dp => {
                const pathPaint = Skia.Paint()
                const opacity = dp.opacity || 1
                
                if (dp.mode === 'erase') {
                    // For eraser, use white color with alpha for dstOut blending
                    pathPaint.setColor(Skia.Color(`rgba(255, 255, 255, ${opacity})`))
                } else {
                    // For drawing, convert color to rgba with opacity
                    const colorWithAlpha = dp.color.startsWith('#') 
                        ? `${dp.color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
                        : `rgba(${dp.color}, ${opacity})`
                    pathPaint.setColor(Skia.Color(colorWithAlpha))
                }
                pathPaint.setStyle(1) // stroke
                pathPaint.setStrokeWidth(dp.strokeWidth)
                pathPaint.setStrokeCap(1) // round
                pathPaint.setStrokeJoin(1) // round
                pathPaint.setAntiAlias(true)
                
                exportCanvasInstance.drawPath(dp.path, pathPaint)
            })
            
            // Capture the export canvas as an image
            const image = exportCanvas.makeImageSnapshot()
            if (!image) {
                Alert.alert('Error', 'Could not capture canvas. Please try again.')
                return
            }

            // Convert to base64 and create a proper file URI
            const imageData = image.encodeToBase64()
            
            // Create a temporary file with proper extension
            const filename = `drawing-${Date.now()}.png`
            const fileUri = `${FileSystem.documentDirectory}${filename}`
            
            // Write the base64 data to a file
            await FileSystem.writeAsStringAsync(fileUri, imageData, {
                encoding: FileSystem.EncodingType.Base64,
            })
            
            // Save to camera roll using the file URI
            await MediaLibrary.saveToLibraryAsync(fileUri)
            
            // Clean up the temporary file
            await FileSystem.deleteAsync(fileUri, { idempotent: true })
            
            // Success feedback
            setShowSaveModal(true)
        } catch (error) {
            console.error('Error saving to camera roll:', error)
            Alert.alert('Error', 'Failed to save drawing. Please try again.')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.push('/room')}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notebook</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity 
                        style={[styles.headerButton, !canUndo && styles.disabledButton]} 
                        onPress={undo}
                        disabled={!canUndo}
                    >
                        <Feather name='rotate-ccw' size={20} color={canUndo ? colors.ink : colors.inkSoft} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.headerButton, !canRedo && styles.disabledButton]} 
                        onPress={redo}
                        disabled={!canRedo}
                    >
                        <Feather name='rotate-cw' size={20} color={canRedo ? colors.ink : colors.inkSoft} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.headerButton, isSaving && styles.disabledButton]} 
                        onPress={saveToCamera}
                        disabled={isSaving}
                    >
                        <Feather name={isSaving ? 'download' : 'download'} size={20} color={isSaving ? colors.inkSoft : colors.ink} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerButton} onPress={clearCanvas}>
                        <Feather name='trash-2' size={20} color={colors.inkSoft} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Spiral binding */}
            <View style={styles.spiralBinding}>
                {Array.from({ length: 20 }, (_, i) => <View key={i} style={styles.spiralHole} />)}
            </View>

            {/* Canvas */}
            <View style={styles.canvasContainer}>
                <GestureDetector gesture={pan}>
                    <Canvas 
                        ref={canvasRef} 
                        style={styles.canvas}
                        onLayout={(e) => {
                            const { width, height } = e.nativeEvent.layout
                            setCanvasDimensions({ width, height })
                        }}
                    >
                        {/* finished strokes */}
                        {paths.map((dp, i) => (
                            <Path
                                key={`stroke-${i}`}
                                path={dp.path}
                                color={dp.color}
                                style='stroke'
                                strokeWidth={dp.strokeWidth}
                                strokeCap='round'
                                strokeJoin='round'
                                blendMode={dp.mode === 'erase' ? 'dstOut' : (dp.blendMode || 'srcOver')}
                                opacity={dp.opacity || 1}
                                antiAlias
                            />
                        ))}

                        {/* live stroke preview */}
                        {currentPath && !isErasing && (
                            // Ink gradient layers for live preview
                            Array.from({ length: 6 }, (_, i) => {
                                const layerProgress = i / 5 // 0 to 1
                                const baseStroke = BRUSH_SIZES[selectedBrushSize]
                                const layerWidth = baseStroke + (layerProgress * baseStroke * 0.3)
                                const layerOpacity = INK_SATURATION * (1 - Math.pow(layerProgress, 1.5) * 0.85)

                                return (
                                    <Path
                                        key={`live-${i}`}
                                        path={currentPath}
                                        color={selectedColor}
                                        style='stroke'
                                        strokeWidth={layerWidth}
                                        strokeCap='round'
                                        strokeJoin='round'
                                        blendMode='srcOver'
                                        opacity={Math.max(0.08, layerOpacity)}
                                        antiAlias
                                    />
                                )
                            })
                        )}
                        
                        {/* live eraser - show soft eraser preview */}
                        {currentPath && isErasing && (
                            <>
                                {/* Center eraser */}
                                <Path
                                    path={currentPath}
                                    color='#FFFFFF'
                                    style='stroke'
                                    strokeWidth={ERASER_SIZES[selectedBrushSize]}
                                    strokeCap='round'
                                    strokeJoin='round'
                                    blendMode='dstOut'
                                    opacity={1}
                                    antiAlias
                                />
                                {/* Soft edges */}
                                <Path
                                    path={currentPath}
                                    color='#FFFFFF'
                                    style='stroke'
                                    strokeWidth={ERASER_SIZES[selectedBrushSize] * 1.25}
                                    strokeCap='round'
                                    strokeJoin='round'
                                    blendMode='dstOut'
                                    opacity={0.82}
                                    antiAlias
                                />
                                <Path
                                    path={currentPath}
                                    color='#FFFFFF'
                                    style='stroke'
                                    strokeWidth={ERASER_SIZES[selectedBrushSize] * 1.5}
                                    strokeCap='round'
                                    strokeJoin='round'
                                    blendMode='dstOut'
                                    opacity={0.64}
                                    antiAlias
                                />
                                <Path
                                    path={currentPath}
                                    color='#FFFFFF'
                                    style='stroke'
                                    strokeWidth={ERASER_SIZES[selectedBrushSize] * 1.75}
                                    strokeCap='round'
                                    strokeJoin='round'
                                    blendMode='dstOut'
                                    opacity={0.46}
                                    antiAlias
                                />
                                <Path
                                    path={currentPath}
                                    color='#FFFFFF'
                                    style='stroke'
                                    strokeWidth={ERASER_SIZES[selectedBrushSize] * 2}
                                    strokeCap='round'
                                    strokeJoin='round'
                                    blendMode='dstOut'
                                    opacity={0.28}
                                    antiAlias
                                />
                            </>
                        )}
                    </Canvas>
                </GestureDetector>

                {/* Notebook lines overlay */}
                <View style={styles.notebookLines} pointerEvents='none'>
                    {Array.from({ length: 25 }, (_, i) => <View key={i} style={styles.notebookLine} />)}
                </View>
            </View>

            {/* Toolbar Toggle (when toolbar is visible) */}
            {toolbarVisible && (
                <View style={styles.toolbarToggleContainer}>
                    <TouchableOpacity 
                        style={styles.toolbarToggle} 
                        onPress={() => setToolbarVisible(false)}
                    >
                        <Feather name='chevron-down' size={16} color={colors.inkSoft} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Toolbar */}
            {toolbarVisible && (
                <View style={styles.toolbar}>
                <View style={styles.toolSection}>
                    <View style={styles.colorSelectorContainer}>
                        <TouchableOpacity 
                            style={[styles.colorPreview, { backgroundColor: selectedColor }]}
                            onPress={() => setShowColorWheel(!showColorWheel)}
                        />
                        
                        {/* Rotatable color wheel with target (right semicircle only) */}
                        {showColorWheel && (
                            <>
                                <TouchableOpacity
                                    style={styles.colorWheelBackdrop}
                                    activeOpacity={1}
                                    onPress={() => setShowColorWheel(false)}
                                />

                                {/* Viewport shows ONLY the right half */}
                                <View style={styles.wheelViewport}>
                                    <GestureDetector gesture={colorWheelGesture}>
                                        <Animated.View style={[styles.wheel, wheelAnimatedStyle]}>
                                            {(() => {
                                                const baseColors = [
                                                    '#FF0000','#FF4500','#FFD700','#32CD32','#00BFFF',
                                                    '#9400D3','#FF1493','#8B4513','#2F2F2F', colors.ink
                                                ];
                                                const swatchSize = 32;
                                                const padding = 8;
                                                const radius = 85;
                                                const arcLength = swatchSize + padding;
                                                const anglePer = (arcLength / radius) * (180 / Math.PI); // degrees
                                                
                                                // Create enough swatches to fill the full circle for infinite scroll
                                                const totalSwatches = Math.ceil(360 / anglePer);

                                                return Array.from({ length: totalSwatches }).map((_, i) => {
                                                    // start at 12 o'clock and go clockwise around full circle
                                                    const angle = -90 + i * anglePer;
                                                    const rad = (angle * Math.PI) / 180;
                                                    const x = Math.cos(rad) * radius;
                                                    const y = Math.sin(rad) * radius;

                                                    const color = baseColors[i % baseColors.length];
                                                    return (
                                                        <View
                                                            key={`wheel-${i}`}
                                                            style={[
                                                                styles.curvedColorSwatch,
                                                                {
                                                                    backgroundColor: color,
                                                                    transform: [{ translateX: x }, { translateY: y }],
                                                                },
                                                            ]}
                                                        />
                                                    );
                                                });
                                            })()}
                                        </Animated.View>
                                    </GestureDetector>

                                    {/* Fades (overlay, non-interactive) */}
                                    <LinearGradient
                                        pointerEvents="none"
                                        colors={['rgba(253, 252, 248, 1)', 'rgba(253, 252, 248, 0)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.fadeLeft}
                                    />
                                    <LinearGradient
                                        pointerEvents="none"
                                        colors={['rgba(253, 252, 248, 1)', 'rgba(253, 252, 248, 0)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 0, y: 1 }}
                                        style={styles.fadeTop}
                                    />
                                    <LinearGradient
                                        pointerEvents="none"
                                        colors={['rgba(253, 252, 248, 0)', 'rgba(253, 252, 248, 1)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 0, y: 1 }}
                                        style={styles.fadeBottom}
                                    />

                                    {/* Target dot centered on the right edge */}
                                    <View style={styles.wheelTarget} />
                                </View>
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.toolSection}>
                    <View style={styles.brushToolsContainer}>
                        <View style={styles.brushPicker}>
                            {Object.entries(BRUSH_SIZES).map(([k, w]) => (
                                <TouchableOpacity
                                    key={k}
                                    style={[
                                        styles.brushButton,
                                        selectedBrushSize === k && styles.selectedBrush
                                    ]}
                                    onPress={() => {
                                        setSelectedBrushSize(k as BrushSizeKey)
                                        setIsErasing(false)
                                    }}
                                >
                                    <View style={[
                                        styles.brushPreview,
                                        { width: w * 2.5, height: w * 2.5, backgroundColor: selectedColor }
                                    ]} />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.toolDivider} />
                        <TouchableOpacity
                            style={[styles.eraserButton, isErasing && styles.selectedEraser]}
                            onPress={() => {
                                setIsErasing(v => !v)
                            }}
                        >
                            <MaterialCommunityIcons name='eraser' size={24} color={isErasing ? colors.paper : colors.ink} />
                        </TouchableOpacity>
                    </View>
                </View>

            </View>
            )}

            {/* Floating Mini Toolbar (when main toolbar is hidden) */}
            {!toolbarVisible && (
                <View style={styles.floatingToolbar}>
                    <TouchableOpacity
                        style={styles.floatingButton}
                        onPress={() => setToolbarVisible(true)}
                    >
                        <Feather name='chevron-up' size={18} color={colors.ink} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.floatingColorButton, { backgroundColor: selectedColor }]}
                        onPress={() => setToolbarVisible(true)}
                    />
                    <TouchableOpacity
                        style={[styles.floatingButton, isErasing && styles.floatingButtonActive]}
                        onPress={() => {
                            setIsErasing(v => !v)
                        }}
                    >
                        <MaterialCommunityIcons name='eraser' size={18} color={isErasing ? colors.paper : colors.ink} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Clear Confirmation Modal */}
            <Modal
                visible={showClearModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowClearModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowClearModal(false)}>
                    <Pressable style={styles.clearModal} onPress={(e) => e.stopPropagation()}>
                        <TouchableOpacity 
                            style={styles.modalCloseButton}
                            onPress={() => setShowClearModal(false)}
                        >
                            <Feather name="x" size={24} color={colors.ink} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Clear Notebook</Text>
                        
                        <View style={styles.modalSection}>
                            <Text style={styles.modalText}>
                                Are you sure you want to clear all your drawings? This action cannot be undone.
                            </Text>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setShowClearModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={confirmClear}
                            >
                                <Text style={styles.confirmButtonText}>Clear</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>


            {/* Save Success Modal */}
            <Modal
                visible={showSaveModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowSaveModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowSaveModal(false)}>
                    <Pressable style={styles.clearModal} onPress={(e) => e.stopPropagation()}>
                        <TouchableOpacity 
                            style={styles.modalCloseButton}
                            onPress={() => setShowSaveModal(false)}
                        >
                            <Feather name="x" size={24} color={colors.ink} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Saved!</Text>
                        
                        <View style={styles.modalSection}>
                            <Feather name="check-circle" size={48} color={colors.accent} style={{marginBottom: 16}} />
                            <Text style={styles.modalText}>
                                Your drawing has been saved to your photo library.
                            </Text>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={() => setShowSaveModal(false)}
                            >
                                <Text style={styles.confirmButtonText}>Great!</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.paper },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: colors.stroke
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#fdfcf8',
        borderWidth: 2,
        borderColor: colors.stroke,
        alignItems: 'center',
        justifyContent: 'center'
    },
    backArrow: { fontSize: 20, color: colors.ink, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    headerButton: { 
        padding: 12,
        borderRadius: 8
    },
    disabledButton: {
        opacity: 0.5
    },
    spiralBinding: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        paddingVertical: 8,
        paddingHorizontal: 20,
        backgroundColor: '#f8f3e8',
        borderBottomWidth: 1,
        borderBottomColor: '#e1d9c9'
    },
    spiralHole: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#d8d2c6',
        borderWidth: 1,
        borderColor: '#c5bfb3'
    },
    canvasContainer: {
        flex: 1,
        position: 'relative',
        margin: 16,
        backgroundColor: colors.paper,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: colors.stroke,
        overflow: 'hidden'
    },
    canvas: { flex: 1, backgroundColor: colors.paper },
    notebookLines: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        paddingHorizontal: 20,
        paddingVertical: 20
    },
    notebookLine: { height: 1, backgroundColor: 'rgba(79,109,156,0.1)', marginVertical: 15 },
    toolbar: {
        backgroundColor: '#fdfcf8',
        borderTopWidth: 2,
        borderTopColor: colors.stroke,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    toolSection: { alignItems: 'center' },
    toolLabel: { fontSize: 12, color: colors.inkSoft, fontWeight: '600', marginBottom: 8 },
    colorSelectorContainer: { alignItems: 'center', position: 'relative' },
    colorPreview: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: colors.stroke,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    brushToolsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: '#faf7f0',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e8e3d6',
    },
    brushPicker: { flexDirection: 'row', gap: 6 },
    brushButton: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.paper, borderWidth: 2, borderColor: '#e8e3d6',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    selectedBrush: { 
        borderColor: colors.ink, 
        backgroundColor: '#f0f5ff',
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    brushPreview: { borderRadius: 12 },
    toolDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#d8d2c6',
        marginHorizontal: 4,
    },
    eraserButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.paper,
        borderWidth: 2,
        borderColor: '#e8e3d6',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    selectedEraser: {
        backgroundColor: colors.ink,
        borderColor: colors.ink,
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    toolRow: { 
        flexDirection: 'row', 
        gap: 8 
    },
    toolButton: {
        alignItems: 'center', 
        justifyContent: 'center',
        paddingVertical: 8, 
        paddingHorizontal: 12,
        borderRadius: 12, 
        borderWidth: 2, 
        borderColor: colors.stroke,
        minWidth: 64,
        backgroundColor: colors.paper,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    toolButtonNoBorder: {
        alignItems: 'center', 
        justifyContent: 'center',
        paddingVertical: 8, 
        paddingHorizontal: 12,
        borderRadius: 12, 
        minWidth: 64,
        backgroundColor: 'transparent',
    },
    selectedTool: { 
        backgroundColor: colors.ink, 
        borderColor: colors.ink,
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    toolButtonText: { fontSize: 10, color: colors.ink, fontWeight: '600', marginTop: 2 },
   
    // Toolbar toggle styles
    toolbarToggleContainer: {
        alignItems: 'center',
        paddingVertical: 4,
        backgroundColor: colors.paper
    },
    toolbarToggle: {
        paddingHorizontal: 20,
        paddingVertical: 4,
        backgroundColor: '#fdfcf8',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.stroke
    },
   
    // Floating toolbar styles
    floatingToolbar: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        flexDirection: 'row',
        backgroundColor: colors.paper,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: colors.stroke,
        padding: 10,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
        transform: [{ rotate: '-1deg' }]
    },
    floatingColorButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: colors.stroke,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    floatingButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.paper,
        borderWidth: 2,
        borderColor: colors.stroke,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    floatingButtonNoBorder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    floatingButtonActive: {
        backgroundColor: colors.ink,
        borderColor: colors.ink,
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        elevation: 5,
    },
   
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(39, 76, 119, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    clearModal: {
        backgroundColor: colors.paper,
        borderRadius: 16,
        borderWidth: 3,
        borderColor: colors.stroke,
        padding: 24,
        width: '100%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        transform: [{ rotate: '-0.5deg' }]
    },
    modalCloseButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#fdfcf8',
        borderWidth: 2,
        borderColor: colors.stroke,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.ink,
        textAlign: 'center',
        marginBottom: 16,
        fontStyle: 'italic',
        transform: [{ rotate: '0.5deg' }]
    },
    modalSection: {
        alignItems: 'center',
        paddingVertical: 8
    },
    modalText: {
        fontSize: 16,
        color: colors.inkSoft,
        textAlign: 'center',
        lineHeight: 24,
        fontStyle: 'italic'
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center'
    },
    cancelButton: {
        backgroundColor: colors.paper,
        borderColor: colors.stroke
    },
    confirmButton: {
        backgroundColor: '#dc3545',
        borderColor: '#dc3545'
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.ink
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.paper
    },
    
    // Color wheel overlay styles
    colorWheelBackdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        zIndex: 5,
    },
    wheelViewport: {
        position: 'absolute',
        top: -60,
        left: 0,         // move closer to the active color
        width: 100,       // shows exactly the right half (200/2)
        height: 180,
        overflow: 'hidden',
        zIndex: 10,
        backgroundColor: 'transparent',
    },
    wheel: {
        position: 'absolute',
        width: 200,
        height: 200,
        left: -100,       // shift the 200px wheel left so only the RIGHT half is visible
        top: -10,         // center vertically in 180px viewport ((180-200)/2)
        alignItems: 'center',
        justifyContent: 'center',
    },
    /* Fades */
    fadeLeft: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 18,    // feather width; tweak to taste
        zIndex: 12,
    },
    fadeTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 18,
        zIndex: 12,
    },
    fadeBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 18,
        zIndex: 12,
    },
    
    wheelTarget: {
        position: 'absolute',
        right: -4,    // keep the target on the visible right edge
        top: 86,      // (180/2) - (8/2)
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.ink,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
        elevation: 8,
        zIndex: 15,
    },
    curvedColorSwatch: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 3,
        borderColor: colors.paper,
    },
})