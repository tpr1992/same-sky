import { Feather } from '@expo/vector-icons'
import * as MediaLibrary from 'expo-media-library'
import { useRouter } from 'expo-router'
import React, { useRef, useState } from 'react'
import { Alert, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { PKCanvas, PKCanvasRef } from '../lib/native/PKCanvas'
import { colors } from '../theme'

type Tool = 'pencil' | 'pen' | 'marker' | 'fountainPen' | 'eraserVector' | 'eraserBitmap'
type BrushSizeKey = 'thin' | 'medium' | 'thick'

const BRUSH_SIZES: Record<BrushSizeKey, number> = {
    thin: 2,
    medium: 4, 
    thick: 8
}

const DRAW_COLORS = [
    '#2B2B2B',
    '#4A4A4A',
    '#8B4513',
    '#654321',
    '#B22222',
    '#DC143C',
    '#FF6347',
    '#FF8C00',
    '#DAA520',
    '#228B22',
    '#2E8B57',
    '#4682B4',
    '#483D8B',
    '#8B008B',
    '#9932CC',
    colors.ink,
]

const INK_COLOR: Record<Tool, string> = {
    pen: '#0B0F1A',
    fountainPen: '#0E0E12',
    marker: '#FFF200',
    pencil: '#2D2D2D',
    eraserVector: '#000000',
    eraserBitmap: '#000000'
}

const DEFAULT_WIDTH_BY_TOOL: Record<Tool, 'thin'|'medium'|'thick'> = {
    pen: 'thin',
    fountainPen: 'medium',
    pencil: 'medium',
    marker: 'thick',
    eraserVector: 'medium',
    eraserBitmap: 'medium'
}

export default function NotebookCanvasV2() {
    const router = useRouter()
    const canvasRef = useRef<PKCanvasRef>(null)

    const [selectedColor, setSelectedColor] = useState(INK_COLOR['pencil'])
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
    
    const wheelRotation = useSharedValue(0)
    
    if (Platform.OS !== 'ios') {
        return (
            <SafeAreaView style={styles.container}>
                {/* Header — HIDDEN ON iOS */}
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

    const handleToolChange = (newTool: Tool) => {
        setSelectedTool(newTool)
        if (newTool === 'marker') {
            setSelectedColor(INK_COLOR.marker)
            setSelectedBrushSize('thick')
        } else if (newTool === 'fountainPen') {
            setSelectedColor(INK_COLOR.fountainPen)
            setSelectedBrushSize('medium')
        } else if (newTool === 'pen') {
            setSelectedColor(INK_COLOR.pen)
            setSelectedBrushSize('thin')
        } else {
            setSelectedColor(INK_COLOR.pencil)
            setSelectedBrushSize('medium')
        }
        if (isErasing) setIsErasing(false)
    }

    const getToolInfo = (tool: Tool) => {
        switch (tool) {
            case 'pencil':
                return { name: 'Pencil', icon: 'pencil' }
            case 'pen':
                return { name: 'Pen', icon: 'pen' }
            case 'marker':
                return { name: 'Marker', icon: 'marker' }
            case 'fountainPen':
                return { name: 'Fountain Pen', icon: 'feather' }
            default:
                return { name: 'Pencil', icon: 'pencil' }
        }
    }

    const availableTools: Tool[] = ['pencil', 'pen', 'marker', 'fountainPen']
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

    const testBridge = () => {
        console.log('Testing bridge')
    }

    const saveToCamera = async () => {
        if (isSaving) return

        setIsSaving(true)
        try {
            // Photos permission: accept granted or limited
            let perm = await MediaLibrary.getPermissionsAsync()
            if (!(perm.granted || perm.accessPrivileges === 'limited')) {
                perm = await MediaLibrary.requestPermissionsAsync()
            }
            if (!(perm.granted || perm.accessPrivileges === 'limited')) {
                Alert.alert('Permission Required', 'Please allow access to your photo library to save drawings')
                return
            }

            // Let layout settle just in case
            await new Promise(r => setTimeout(r, 0))

            // Try native PK export first
            let base64 = await canvasRef.current?.exportBase64()
            if (!base64 || base64.length < 10) {
                console.warn('exportBase64 returned empty, trying snapshot fallback')
                base64 = await canvasRef.current?.exportBase64Snapshot()
            }
            if (!base64 || base64.length < 10) {
                Alert.alert('Nothing to save', 'The page looks empty or export failed')
                return
            }

            const FileSystem = await import('expo-file-system')
            const filename = `drawing-${Date.now()}.png`
            const fileUri = `${FileSystem.documentDirectory}${filename}`
            await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64
            })

            await MediaLibrary.createAssetAsync(fileUri)
            await FileSystem.deleteAsync(fileUri, { idempotent: true })
            setShowSaveModal(true)
        } catch (error: any) {
            console.error('Error saving to camera roll:', error)
            Alert.alert('Error', error?.message ?? 'Failed to save drawing. Please try again.')
        } finally {
            setIsSaving(false)
        }
    }




    const wheelAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${wheelRotation.value}deg` }]
    }))

    const updateSelectedColorFromWheel = (rotation: number) => {
        const baseColors = [
            '#FF0000','#FF4500','#FFD700','#32CD32','#00BFFF',
            '#9400D3','#FF1493','#8B4513','#2F2F2F','#000000', colors.ink
        ]
        const degreesPerColor = 360 / baseColors.length
        const offset = 90
        const normalized = (((rotation + offset) % 360) + 360) % 360
        const idx = Math.round(normalized / degreesPerColor) % baseColors.length
        const targetColor = baseColors[idx]
        if (targetColor && targetColor !== selectedColor) {
            setSelectedColor(targetColor)
            setIsErasing(false)
        }
    }

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
            {/* <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.push('/room')}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notebook</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity style={[styles.headerButton, isSaving && styles.disabledButton]} onPress={saveToCamera} disabled={isSaving}>
                        <Feather name='download' size={20} color={isSaving ? colors.inkSoft : colors.ink} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerButton} onPress={clearCanvas}>
                        <Feather name='trash-2' size={20} color={colors.inkSoft} />
                    </TouchableOpacity>
                </View>
            </View> */}

            {/* Header v2 */}
            <View style={styles.minHeader}>
                <TouchableOpacity style={styles.minHeaderBtn} onPress={() => router.push('/room')}>
                    <Feather name='arrow-left' size={18} color={colors.ink} />
                    <Text style={styles.minHeaderText}>Back</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={[styles.minHeaderBtn, isSaving && styles.disabled]} onPress={saveToCamera} disabled={isSaving}>
                    <Feather name='download' size={18} color={isSaving ? colors.inkSoft : colors.ink} />
                    <Text style={styles.minHeaderText}>{isSaving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
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

            {/* Toolbar Toggle — HIDDEN
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
            */}

            {/* Bottom Toolbar — HIDDEN
            {toolbarVisible && (
                <View style={styles.toolbar}>
                    ...
                </View>
            )}
            */}

            {/* Floating Mini Toolbar — HIDDEN
            {!toolbarVisible && (
                <View style={styles.floatingToolbar}>
                    ...
                </View>
            )}
            */}

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

    /* Minimal header */
    minHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.stroke,
        backgroundColor: '#fdfcf8'
    },
    minHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.stroke,
        backgroundColor: colors.paper
    },
    minHeaderText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.ink
    },
    disabled: { opacity: 0.5 },
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
        minWidth: 115,
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
        borderBottomWidth: 0,
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
        minWidth: 50,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },

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
})
