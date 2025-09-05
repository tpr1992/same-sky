import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { colors } from '../theme'
import { multiUserDrawingService, DrawingSession } from '../lib/services/MultiUserDrawing'

export default function DebugMultiUser() {
    const router = useRouter()
    const [sessions, setSessions] = useState<string[]>([])
    const [selectedSession, setSelectedSession] = useState<string>('')
    const [sessionDetails, setSessionDetails] = useState<DrawingSession | null>(null)
    const [newUserName, setNewUserName] = useState('')
    const [availableColors] = useState(multiUserDrawingService.getUserColors())

    useEffect(() => {
        loadSessions()
    }, [])

    const loadSessions = async () => {
        const sessionList = await multiUserDrawingService.listSessions()
        setSessions(sessionList)
    }

    const loadSessionDetails = async (sessionId: string) => {
        try {
            const session = await multiUserDrawingService.joinSession(sessionId, {
                id: 'debug_viewer',
                name: 'Debug Viewer',
                color: '#cccccc'
            })
            if (session) {
                setSessionDetails(session)
                setSelectedSession(sessionId)
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to load session details')
        }
    }

    const simulateUserJoin = async () => {
        if (!selectedSession || !newUserName.trim()) {
            Alert.alert('Error', 'Please select a session and enter a user name')
            return
        }

        try {
            const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)]
            const newUser = {
                id: multiUserDrawingService.generateUserId(),
                name: newUserName.trim(),
                color: randomColor
            }

            await multiUserDrawingService.joinSession(selectedSession, newUser)
            await loadSessionDetails(selectedSession)
            setNewUserName('')
            Alert.alert('Success', `${newUser.name} joined the session!`)
        } catch (error) {
            Alert.alert('Error', 'Failed to add user to session')
        }
    }

    const switchToUser = async (userId: string) => {
        if (!sessionDetails) return

        const user = sessionDetails.users.find(u => u.id === userId)
        if (!user) return

        try {
            multiUserDrawingService.setCurrentUser(user)
            Alert.alert(
                'User Switched',
                `You are now ${user.name}. Go to the drawing canvas to test.`,
                [
                    { text: 'Go to Canvas', onPress: () => router.push('/notebook-canvas-v2') },
                    { text: 'Stay Here', style: 'cancel' }
                ]
            )
        } catch (error) {
            Alert.alert('Error', 'Failed to switch user')
        }
    }

    const forceTurnChange = async () => {
        if (!sessionDetails) return

        try {
            await multiUserDrawingService.endTurn()
            await loadSessionDetails(selectedSession)
            Alert.alert('Success', 'Turn changed!')
        } catch (error) {
            Alert.alert('Error', 'Failed to change turn')
        }
    }

    const clearAllSessions = async () => {
        Alert.alert(
            'Clear All Sessions',
            'This will delete all stored drawing sessions. Are you sure?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        await multiUserDrawingService.clearAllSessions()
                        await loadSessions()
                        setSessionDetails(null)
                        setSelectedSession('')
                        Alert.alert('Success', 'All sessions cleared')
                    }
                }
            ]
        )
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.push('/room')}>
                    <Feather name='arrow-left' size={18} color={colors.ink} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Multi-User Debug</Text>
                <Text style={styles.subtitle}>Test multi-user functionality on a single device</Text>

                {/* Sessions List */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Sessions ({sessions.length})</Text>
                        <TouchableOpacity style={styles.refreshButton} onPress={loadSessions}>
                            <Feather name='refresh-cw' size={16} color={colors.ink} />
                        </TouchableOpacity>
                    </View>

                    {sessions.length === 0 ? (
                        <Text style={styles.noSessions}>No sessions found. Create one first!</Text>
                    ) : (
                        sessions.map((sessionId) => (
                            <TouchableOpacity 
                                key={sessionId} 
                                style={[styles.sessionItem, selectedSession === sessionId && styles.selectedSession]}
                                onPress={() => loadSessionDetails(sessionId)}
                            >
                                <Text style={styles.sessionId}>{sessionId}</Text>
                                <Feather name='chevron-right' size={16} color={colors.inkSoft} />
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Session Details */}
                {sessionDetails && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Session Details</Text>
                        
                        <View style={styles.detailItem}>
                            <Text style={styles.label}>Current Turn:</Text>
                            <Text style={styles.value}>
                                {sessionDetails.users.find(u => u.id === sessionDetails.currentTurn)?.name || 'Unknown'}
                            </Text>
                            <TouchableOpacity style={styles.actionButton} onPress={forceTurnChange}>
                                <Text style={styles.actionButtonText}>Next Turn</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.detailItem}>
                            <Text style={styles.label}>Users ({sessionDetails.users.length}):</Text>
                        </View>

                        {sessionDetails.users.map((user) => (
                            <TouchableOpacity 
                                key={user.id} 
                                style={styles.userItem}
                                onPress={() => switchToUser(user.id)}
                            >
                                <View style={styles.userInfo}>
                                    <View style={[styles.userDot, { backgroundColor: user.color }]} />
                                    <Text style={styles.userName}>{user.name}</Text>
                                    {sessionDetails.currentTurn === user.id && (
                                        <View style={styles.turnBadge}>
                                            <Text style={styles.turnText}>Current Turn</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.switchText}>Tap to switch</Text>
                            </TouchableOpacity>
                        ))}

                        <View style={styles.addUserSection}>
                            <Text style={styles.label}>Add Test User:</Text>
                            <View style={styles.addUserRow}>
                                <TextInput
                                    style={styles.userInput}
                                    value={newUserName}
                                    onChangeText={setNewUserName}
                                    placeholder="Enter name"
                                    placeholderTextColor={colors.inkSoft}
                                />
                                <TouchableOpacity 
                                    style={styles.addButton} 
                                    onPress={simulateUserJoin}
                                    disabled={!newUserName.trim()}
                                >
                                    <Text style={styles.addButtonText}>Add</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Actions</Text>
                    
                    <TouchableOpacity style={styles.createButton} onPress={() => router.push('/multi-user-setup')}>
                        <Feather name='plus' size={20} color={colors.paper} />
                        <Text style={styles.createButtonText}>Create New Session</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.dangerButton} onPress={clearAllSessions}>
                        <Feather name='trash-2' size={20} color={colors.paper} />
                        <Text style={styles.dangerButtonText}>Clear All Sessions</Text>
                    </TouchableOpacity>
                </View>

                {/* Instructions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Testing Instructions</Text>
                    <Text style={styles.instructions}>
                        1. Create a session with multiple users using "Add Test User"{'\n'}
                        2. Switch between users by tapping on them{'\n'}
                        3. Go to the drawing canvas to test turn-based drawing{'\n'}
                        4. Use "Next Turn" to manually advance turns{'\n'}
                        5. Drawing state should persist between user switches
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.paper
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.stroke
    },
    backButton: {
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
    backText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.ink
    },
    content: {
        flex: 1,
        paddingHorizontal: 20
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.ink,
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        color: colors.inkSoft,
        textAlign: 'center',
        marginBottom: 32
    },
    section: {
        marginBottom: 32,
        backgroundColor: '#fdfcf8',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.stroke,
        padding: 16
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.ink
    },
    refreshButton: {
        padding: 4
    },
    noSessions: {
        fontSize: 14,
        color: colors.inkSoft,
        textAlign: 'center',
        fontStyle: 'italic'
    },
    sessionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.stroke,
        marginBottom: 8
    },
    selectedSession: {
        backgroundColor: colors.ink,
        borderColor: colors.ink
    },
    sessionId: {
        fontSize: 14,
        color: colors.ink,
        fontFamily: 'monospace'
    },
    detailItem: {
        marginBottom: 12
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.ink,
        marginBottom: 4
    },
    value: {
        fontSize: 14,
        color: colors.inkSoft
    },
    actionButton: {
        alignSelf: 'flex-start',
        backgroundColor: colors.accent,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginTop: 4
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.paper
    },
    userItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: colors.paper,
        borderWidth: 1,
        borderColor: colors.stroke,
        marginBottom: 4
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    userDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8
    },
    userName: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.ink,
        marginRight: 8
    },
    turnBadge: {
        backgroundColor: colors.accent,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    turnText: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.paper
    },
    switchText: {
        fontSize: 12,
        color: colors.inkSoft,
        fontStyle: 'italic'
    },
    addUserSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.stroke
    },
    addUserRow: {
        flexDirection: 'row',
        gap: 8
    },
    userInput: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.stroke,
        backgroundColor: colors.paper,
        fontSize: 14,
        color: colors.ink
    },
    addButton: {
        backgroundColor: colors.ink,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.paper
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.ink,
        paddingVertical: 12,
        borderRadius: 8,
        marginBottom: 8
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.paper
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#dc3545',
        paddingVertical: 12,
        borderRadius: 8
    },
    dangerButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.paper
    },
    instructions: {
        fontSize: 14,
        color: colors.ink,
        lineHeight: 20
    }
})