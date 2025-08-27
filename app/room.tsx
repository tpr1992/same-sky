import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { Alert, Image, ImageBackground, Modal, Pressable, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { authService } from '../services/auth'
import { colors } from '../theme'

const roomImage = require('../assets/images/room-sketch.png')

// left/top/width/height are all 0..1 percentages relative to the image content
type Hotspot = { id: 'notebook' | 'window' | 'lamp' | 'calendar' | 'clock' | 'exit', x: number, y: number, w: number, h: number, label: string }

// Initial guesses tuned to your sketch; tweak with debug overlay if needed
const HOTSPOTS: Hotspot[] = [
    // Window across the top behind the headboard
    { id: 'window',   label: 'Window',   x: 0.15, y: 0.05, w: 0.70, h: 0.23 },
    // Right bedside lamp
    { id: 'lamp',     label: 'Lamp',     x: 0.85, y: 0.19, w: 0.12, h: 0.15 },
    // Notebook centered on duvet
    { id: 'notebook', label: 'Notebook', x: 0.42, y: 0.51, w: 0.26, h: 0.11 },
    // Calendar on the wall
    { id: 'calendar', label: 'Calendar', x: 0.03, y: 0.13, w: 0.12, h: 0.09 },
    // Clock on bedside table (left side)
    { id: 'clock',    label: 'Clock',    x: 0.04, y: 0.25, w: 0.10, h: 0.10 },
    // Exit - hidden hotspot to return to app landing page
    { id: 'exit',    label: 'Exit',    x: 0.04, y: 0.9, w: 0.10, h: 0.10 }

]

export default function Room() {
    const router = useRouter()
    const [boxW, setBoxW] = useState(0)
    const [boxH, setBoxH] = useState(0)
    const [debug, setDebug] = useState(false)
    const [showTimeModal, setShowTimeModal] = useState(false)
    const [showLogoutModal, setShowLogoutModal] = useState(false)
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    const src = Image.resolveAssetSource(roomImage)
    const ASPECT = src.width / src.height

    const { imgW, imgH } = contain(boxW, boxH, ASPECT)

    const formatTime = (date: Date, timeZone: string) => {
        try {
            return date.toLocaleString('en-US', {
                timeZone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            })
        } catch (error) {
            // Fallback if timezone is not supported
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            })
        }
    }

    const formatDate = (date: Date, timeZone: string) => {
        try {
            return date.toLocaleDateString('en-US', {
                timeZone,
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            })
        } catch (error) {
            // Fallback if timezone is not supported
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            })
        }
    }

    const getLocalTimeZone = () => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone
        } catch (error) {
            return 'Local Time'
        }
    }

    const handleLogout = async () => {
        try {
            await authService.logout()
            setShowLogoutModal(false)
            router.replace('/')
        } catch (error) {
            Alert.alert('Error', 'Failed to log out. Please try again.')
        }
    }

    const getDublinTime = () => {
        // Calculate Dublin time: UTC + 0 (winter) or UTC + 1 (summer DST)
        const now = new Date()
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000)

        // Dublin observes DST from last Sunday in March to last Sunday in October
        const year = now.getFullYear()
        const isDST = isDublinDST(now, year)
        const dublinOffset = isDST ? 1 : 0

        return new Date(utc + (dublinOffset * 3600000))
    }

    const isDublinDST = (date: Date, year: number) => {
        // DST starts last Sunday in March
        const marchLastSunday = getLastSunday(year, 2) // March is month 2
        // DST ends last Sunday in October
        const octoberLastSunday = getLastSunday(year, 9) // October is month 9

        return date >= marchLastSunday && date < octoberLastSunday
    }

    const getLastSunday = (year: number, month: number) => {
        const lastDay = new Date(year, month + 1, 0) // Last day of the month
        const dayOfWeek = lastDay.getDay()
        const lastSunday = new Date(year, month, lastDay.getDate() - dayOfWeek)
        return lastSunday
    }

    const onHotspot = async (id: Hotspot['id']) => {
        if (id === 'notebook') router.push('/notebook-canvas-v2')
        if (id === 'window')   Alert.alert('Window', 'Sky • time • weather • constellations')
        if (id === 'lamp')     Alert.alert('Lamp', 'Toggle lamp + set co-reading light scene')
        if (id === 'calendar') Alert.alert('Calendar', 'View the calendar for important dates')
        if (id === 'clock')    setShowTimeModal(true)
        if (id === 'exit') {
            setShowLogoutModal(true)
        }
    }

    return (
        <SafeAreaView style={styles.paperScreen}>
            <View
                style={styles.viewport}
                onLayout={e => {
                    const { width, height } = e.nativeEvent.layout
                    setBoxW(width)
                    setBoxH(height)
                }}
            >
                {!!imgW && !!imgH && (
                    <Pressable onLongPress={() => setDebug(v => !v)} delayLongPress={250} style={{ width: imgW, height: imgH }}>
                        <ImageBackground
                            source={roomImage}
                            resizeMode='stretch'           // exact fit to the computed rect
                            style={{ width: '100%', height: '100%' }}
                        >
                            <View style={StyleSheet.absoluteFill}>
                                {HOTSPOTS.map(hs => (
                                    <Pressable
                                        key={hs.id}
                                        onPress={() => onHotspot(hs.id)}
                                        style={{
                                            position: 'absolute',
                                            left: hs.x * imgW,
                                            top: hs.y * imgH,
                                            width: hs.w * imgW,
                                            height: hs.h * imgH,
                                            borderRadius: 10
                                        }}
                                    >
                                        {debug && (
                                            <View style={{
                                                ...StyleSheet.absoluteFillObject,
                                                borderWidth: 2,
                                                borderStyle: 'dashed',
                                                borderColor: colors.accent,
                                                backgroundColor: 'rgba(240,154,71,0.12)'
                                            }} />
                                        )}
                                    </Pressable>
                                ))}
                            </View>
                        </ImageBackground>
                    </Pressable>
                )}
            </View>

            {/* Time Modal */}
            <Modal
                visible={showTimeModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowTimeModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowTimeModal(false)}>
                    <Pressable style={styles.timeModal} onPress={(e) => e.stopPropagation()}>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowTimeModal(false)}
                        >
                            <Feather name="x" size={24} color={colors.ink} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Current Time</Text>

                        <View style={styles.timeSection}>
                            <Text style={styles.locationLabel}>Dublin</Text>
                            <Text style={styles.timeText}>
                                {currentTime.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                })}
                            </Text>
                            <Text style={styles.dateText}>
                                {currentTime.toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </Text>
                        </View>

                        <View style={styles.timeDivider} />

                        <View style={styles.timeSection}>
                            <Text style={styles.locationLabel}>New York</Text>
                            <Text style={styles.timeText}>
                                {formatTime(currentTime, 'America/New_York')}
                            </Text>
                            <Text style={styles.dateText}>
                                {formatDate(currentTime, 'America/New_York')}
                            </Text>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Logout Modal */}
            <Modal
                visible={showLogoutModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowLogoutModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowLogoutModal(false)}>
                    <Pressable style={styles.timeModal} onPress={(e) => e.stopPropagation()}>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowLogoutModal(false)}
                        >
                            <Feather name="x" size={24} color={colors.ink} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Log Out</Text>

                        <View style={styles.logoutSection}>
                            <Text style={styles.logoutText}>
                                Are you sure you want to log out? You'll need to sign in again to access your shared space.
                            </Text>
                        </View>

                        <View style={styles.logoutButtons}>
                            <TouchableOpacity
                                style={[styles.logoutButton, styles.cancelButton]}
                                onPress={() => setShowLogoutModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.logoutButton, styles.confirmButton]}
                                onPress={handleLogout}
                            >
                                <Text style={styles.confirmButtonText}>Log Out</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    )
}

function contain(boxW: number, boxH: number, aspect: number) {
    if (!boxW || !boxH) return { imgW: 0, imgH: 0 }
    const heightFromWidth = boxW / aspect
    if (heightFromWidth <= boxH) return { imgW: boxW, imgH: heightFromWidth }
    return { imgW: boxH * aspect, imgH: boxH }
}

const styles = StyleSheet.create({
    paperScreen: { flex: 1, backgroundColor: colors.paper },
    viewport: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(39, 76, 119, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    timeModal: {
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
        marginBottom: 24,
        fontStyle: 'italic',
        transform: [{ rotate: '0.5deg' }]
    },
    timeSection: {
        alignItems: 'center',
        paddingVertical: 16
    },
    locationLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.inkSoft,
        marginBottom: 8,
        fontStyle: 'italic'
    },
    timeText: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.ink,
        marginBottom: 4,
        fontFamily: 'monospace'
    },
    dateText: {
        fontSize: 16,
        color: colors.inkSoft,
        fontStyle: 'italic'
    },
    timeDivider: {
        height: 2,
        backgroundColor: colors.stroke,
        marginVertical: 8,
        width: '80%',
        alignSelf: 'center',
        opacity: 0.3
    },
    logoutSection: {
        alignItems: 'center',
        paddingVertical: 16
    },
    logoutText: {
        fontSize: 16,
        color: colors.inkSoft,
        textAlign: 'center',
        lineHeight: 24,
        fontStyle: 'italic'
    },
    logoutButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16
    },
    logoutButton: {
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
    }
})
