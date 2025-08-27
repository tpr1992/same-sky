import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as MediaLibrary from 'expo-media-library'
import { useRouter } from 'expo-router'
import React, { useRef, useState } from 'react'
import { Alert, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { PKCanvas, PKCanvasRef } from '../lib/native/PKCanvas'
import { colors } from '../theme'

type Tool = 'pencil' | 'pen' | 'marker' | 'eraserVector' | 'eraserBitmap'
type BrushSizeKey = 'thin' | 'medium' | 'thick'

const BRUSH_SIZES: Record<BrushSizeKey, number> = {
    thin: 2,
    medium: 4, 
    thick: 8
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

export default function NotebookCanvasV2() {
    const router = useRouter()
    const canvasRef = useRef<PKCanvasRef>(null)
    
    const [selectedColor, setSelectedColor] = useState(colors.ink)
    const [selectedBrushSize, setSelectedBrushSize] = useState<BrushSizeKey>('medium')
    const [selectedTool, setSelectedTool] = useState<Tool>('pencil')
    const [isErasing, setIsErasing] = useState(false)
    const [showClearModal, setShowClearModal] = useState(false)
    const [showSaveModal, setShowSaveModal] = useState(false)
    const [showColorWheel, setShowColorWheel] = useState(false)
    const [showToolDropdown, setShowToolDropdown] = useState(false)
    const [showBrushDropdown, setShowBrushDropdown] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [toolbarVisible, setToolbarVisible] = useState(true)
    
    // Color wheel rotation
    const wheelRotation = useSharedValue(0)
    
    // For iOS only
    if (Platform.OS !== 'ios') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.push('/room')}>
                        <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notebook</Text>
                    <View style={styles.headerButtons} />
                </View>
                <View style={styles.notSupported}>
                    <Text style={styles.notSupportedText}>
                        PencilKit is only available on iOS devices.
                    </Text>
                    <TouchableOpacity 
                        style={styles.fallbackButton}
                        onPress={() => router.push('/notebook-canvas')}
                    >
                        <Text style={styles.fallbackButtonText}>Use Skia Version</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        )
    }

    const getCurrentTool = (): Tool => {
        if (isErasing) return 'eraserVector'
        return selectedTool
    }

    const getToolInfo = (tool: Tool) => {
        switch (tool) {
            case 'pencil':
                return { name: 'Pencil', icon: 'pencil' }
            case 'pen':
                return { name: 'Pen', icon: 'pen' }
            case 'marker':
                return { name: 'Marker', icon: 'marker' }
            default:
                return { name: 'Pencil', icon: 'pencil' }
        }
    }

    const availableTools: Tool[] = ['pencil', 'pen', 'marker']
    const availableBrushSizes: BrushSizeKey[] = ['thin', 'medium', 'thick']

    const getBrushSizeInfo = (size: BrushSizeKey) => {
        switch (size) {
            case 'thin':
                return { name: 'Thin', width: BRUSH_SIZES.thin }
            case 'medium':
                return { name: 'Medium', width: BRUSH_SIZES.medium }
            case 'thick':
                return { name: 'Thick', width: BRUSH_SIZES.thick }
        }
    }

    const clearCanvas = () => {
        setShowClearModal(true)
    }

    const confirmClear = () => {
        canvasRef.current?.clear()
        setShowClearModal(false)
    }

    const undo = () => {
        canvasRef.current?.undo()
    }

    const redo = () => {
        canvasRef.current?.redo()
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

            // Export drawing as base64 PNG
            const base64 = await canvasRef.current?.exportBase64()
            if (!base64) {
                Alert.alert('Error', 'Could not export drawing. Please try again.')
                return
            }

            // Create temporary file with base64 data
            const { FileSystem } = await import('expo-file-system')
            const filename = `drawing-${Date.now()}.png`
            const fileUri = `${FileSystem.documentDirectory}${filename}`
            
            // Write the base64 data to a file
            await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
            })
            
            // Save to camera roll
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
        
        // Use even spacing for color selection
        const degreesPerColor = 360 / baseColors.length;

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
                        style={styles.headerButton} 
                        onPress={undo}
                    >
                        <Feather name='rotate-ccw' size={20} color={colors.ink} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.headerButton} 
                        onPress={redo}
                    >
                        <Feather name='rotate-cw' size={20} color={colors.ink} />
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
                <PKCanvas
                    ref={canvasRef}
                    style={styles.canvas}
                    tool={getCurrentTool()}
                    color={selectedColor}
                    lineWidth={BRUSH_SIZES[selectedBrushSize]}
                    fingerEnabled={true}
                    onBegin={() => {}}
                    onChange={() => {}}
                    onEnd={() => {}}
                />

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
                                                const swatchSize = 28; // Reduced from 32 to prevent overlap
                                                const padding = 8; // 8px spacing between swatches
                                                const radius = 90; // Increased from 85 for more room
                                                const arcLength = swatchSize + padding;
                                                const anglePer = (arcLength / radius) * (180 / Math.PI); // degrees
                                                
                                                // Only create swatches for our base colors, repeated 3 times for smooth infinite scroll
                                                const repetitions = 3;
                                                const totalSwatches = baseColors.length * repetitions;

                                                return Array.from({ length: totalSwatches }).map((_, i) => {
                                                    const colorIndex = i % baseColors.length;
                                                    // start at 12 o'clock and go clockwise around full circle
                                                    const angle = -90 + (i * 360) / totalSwatches;
                                                    const rad = (angle * Math.PI) / 180;
                                                    const x = Math.cos(rad) * radius;
                                                    const y = Math.sin(rad) * radius;

                                                    const color = baseColors[colorIndex];
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

                    <View style={styles.toolDropdownContainer}>
                        <TouchableOpacity 
                            style={styles.toolDropdownButton}
                            onPress={() => setShowToolDropdown(!showToolDropdown)}
                        >
                            <MaterialCommunityIcons 
                                name={getToolInfo(selectedTool).icon as any} 
                                size={18} 
                                color={colors.ink} 
                            />
                            <Text style={styles.toolDropdownText} numberOfLines={1}>
                                {getToolInfo(selectedTool).name}
                            </Text>
                            <Feather 
                                name={showToolDropdown ? 'chevron-up' : 'chevron-down'} 
                                size={14} 
                                color={colors.ink} 
                            />
                        </TouchableOpacity>
                        
                        {showToolDropdown && (
                            <>
                                <TouchableOpacity
                                    style={styles.toolDropdownBackdrop}
                                    activeOpacity={1}
                                    onPress={() => setShowToolDropdown(false)}
                                />
                                <View style={styles.toolDropdownMenu}>
                                    {availableTools.map((tool, index) => {
                                        const toolInfo = getToolInfo(tool)
                                        const isLast = index === availableTools.length - 1
                                        return (
                                            <Pressable
                                                key={tool}
                                                style={({ pressed }) => [
                                                    styles.toolDropdownItem,
                                                    selectedTool === tool && styles.selectedToolDropdownItem,
                                                    pressed && selectedTool !== tool && styles.pressedToolDropdownItem,
                                                    isLast && styles.lastToolDropdownItem
                                                ]}
                                                onPress={() => {
                                                    setSelectedTool(tool)
                                                    setIsErasing(false)
                                                    // Add a small delay to show the selection change before closing
                                                    setTimeout(() => {
                                                        setShowToolDropdown(false)
                                                    }, 150)
                                                }}
                                            >
                                                <MaterialCommunityIcons 
                                                    name={toolInfo.icon as any} 
                                                    size={20} 
                                                    color={selectedTool === tool ? colors.paper : colors.ink} 
                                                />
                                                <Text style={[
                                                    styles.toolDropdownItemText,
                                                    selectedTool === tool && styles.selectedToolDropdownItemText
                                                ]}>
                                                    {toolInfo.name}
                                                </Text>
                                            </Pressable>
                                        )
                                    })}
                                </View>
                            </>
                        )}
                    </View>

                    <View style={styles.brushDropdownContainer}>
                        <TouchableOpacity 
                            style={styles.brushDropdownButton}
                            onPress={() => setShowBrushDropdown(!showBrushDropdown)}
                        >
                            <View style={[
                                styles.brushLinePreview,
                                { 
                                    height: getBrushSizeInfo(selectedBrushSize).width,
                                    backgroundColor: selectedColor 
                                }
                            ]} />
                            <Feather 
                                name={showBrushDropdown ? 'chevron-up' : 'chevron-down'} 
                                size={14} 
                                color={colors.ink} 
                            />
                        </TouchableOpacity>
                        
                        {showBrushDropdown && (
                            <>
                                <TouchableOpacity
                                    style={styles.brushDropdownBackdrop}
                                    activeOpacity={1}
                                    onPress={() => setShowBrushDropdown(false)}
                                />
                                <View style={styles.brushDropdownMenu}>
                                    {availableBrushSizes.map((size, index) => {
                                        const sizeInfo = getBrushSizeInfo(size)
                                        const isLast = index === availableBrushSizes.length - 1
                                        return (
                                            <Pressable
                                                key={size}
                                                style={({ pressed }) => [
                                                    styles.brushDropdownItem,
                                                    selectedBrushSize === size && styles.selectedBrushDropdownItem,
                                                    pressed && selectedBrushSize !== size && styles.pressedBrushDropdownItem,
                                                    isLast && styles.lastBrushDropdownItem
                                                ]}
                                                onPress={() => {
                                                    setSelectedBrushSize(size)
                                                    setIsErasing(false)
                                                    // Add a small delay to show the selection change before closing
                                                    setTimeout(() => {
                                                        setShowBrushDropdown(false)
                                                    }, 150)
                                                }}
                                            >
                                                <View style={[
                                                    styles.brushLinePreview,
                                                    { 
                                                        height: sizeInfo.width,
                                                        backgroundColor: selectedColor 
                                                    }
                                                ]} />
                                            </Pressable>
                                        )
                                    })}
                                </View>
                            </>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.eraserButton, isErasing && styles.selectedEraser]}
                        onPress={() => {
                            setIsErasing(v => !v)
                        }}
                    >
                        <MaterialCommunityIcons name='eraser' size={20} color={isErasing ? colors.paper : colors.ink} />
                    </TouchableOpacity>
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
    canvas: { flex: 1, backgroundColor: '#fdfcf8' },
    notebookLines: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        paddingHorizontal: 20,
        paddingVertical: 20
    },
    notebookLine: { height: 1, backgroundColor: 'rgba(79,109,156,0.1)', marginVertical: 15 },
    
    // Not supported fallback
    notSupported: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32
    },
    notSupportedText: {
        fontSize: 18,
        color: colors.inkSoft,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24
    },
    fallbackButton: {
        backgroundColor: colors.ink,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.ink
    },
    fallbackButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.paper
    },

    // Toolbar styles
    toolbar: {
        backgroundColor: '#fdfcf8',
        borderTopWidth: 2,
        borderTopColor: colors.stroke,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    toolSection: { alignItems: 'center' },
    toolDropdownContainer: {
        position: 'relative',
        alignItems: 'center',
    },
    toolDropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#faf7f0',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e8e3d6',
        paddingVertical: 8,
        paddingHorizontal: 10,
        gap: 4,
        minWidth: 115, // Increased to show full "Marker" text
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    toolDropdownText: {
        fontSize: 12,
        color: colors.ink,
        fontWeight: '600',
        flex: 1,
        textAlign: 'left',
    },
    toolDropdownBackdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        zIndex: 5,
    },
    toolDropdownMenu: {
        position: 'absolute',
        bottom: 50, // Position above the button instead of below
        left: -10,
        right: -10,
        backgroundColor: colors.paper,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.stroke,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 10,
        overflow: 'hidden',
    },
    toolDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
        backgroundColor: colors.paper,
        borderBottomWidth: 1,
        borderBottomColor: '#e8e3d6',
    },
    lastToolDropdownItem: {
        borderBottomWidth: 0, // Remove border from last item
    },
    selectedToolDropdownItem: {
        backgroundColor: colors.ink,
    },
    pressedToolDropdownItem: {
        backgroundColor: '#e8e3d6',
    },
    toolDropdownItemText: {
        fontSize: 14,
        color: colors.ink,
        fontWeight: '500',
        flex: 1,
    },
    selectedToolDropdownItemText: {
        color: colors.paper,
        fontWeight: '600',
    },

    // Brush dropdown styles
    brushDropdownContainer: {
        position: 'relative',
        alignItems: 'center',
    },
    brushDropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#faf7f0',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e8e3d6',
        paddingVertical: 8,
        paddingHorizontal: 10,
        gap: 6,
        minWidth: 50, // Reduced since no text
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    brushDropdownText: {
        fontSize: 12,
        color: colors.ink,
        fontWeight: '600',
        flex: 1,
        textAlign: 'left',
    },
    brushDropdownBackdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        zIndex: 5,
    },
    brushDropdownMenu: {
        position: 'absolute',
        bottom: 50,
        left: -10,
        right: -10,
        backgroundColor: colors.paper,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.stroke,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 10,
        overflow: 'hidden',
    },
    brushDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
        backgroundColor: colors.paper,
        borderBottomWidth: 1,
        borderBottomColor: '#e8e3d6',
    },
    lastBrushDropdownItem: {
        borderBottomWidth: 0,
    },
    selectedBrushDropdownItem: {
        backgroundColor: colors.ink,
    },
    pressedBrushDropdownItem: {
        backgroundColor: '#e8e3d6',
    },
    brushDropdownItemText: {
        fontSize: 14,
        color: colors.ink,
        fontWeight: '500',
        flex: 1,
    },
    selectedBrushDropdownItemText: {
        color: colors.paper,
        fontWeight: '600',
    },
    brushLinePreview: {
        width: 20,
        borderRadius: 2,
        minHeight: 2,
    },

    colorSelectorContainer: { alignItems: 'center', position: 'relative' },
    colorPreview: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: colors.stroke,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    eraserButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
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
        left: -5,         // shift left slightly to prevent clipping
        width: 120,       // increased width to show full swatches without clipping
        height: 180,
        overflow: 'hidden',
        zIndex: 10,
        backgroundColor: 'transparent',
    },
    wheel: {
        position: 'absolute',
        width: 220,
        height: 220,
        left: -115,       // shift further left to account for viewport adjustment
        top: -20,         // center vertically in 180px viewport ((180-220)/2)
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
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: colors.paper,
    },
})