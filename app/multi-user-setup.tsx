import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { colors } from '../theme'
import { multiUserDrawingService, User } from '../lib/services/MultiUserDrawing'

export default function MultiUserSetup() {
    const router = useRouter()
    const [userName, setUserName] = useState('')
    const [selectedColor, setSelectedColor] = useState('#FF6B6B')
    const [sessionId, setSessionId] = useState('')
    const [mode, setMode] = useState<'create' | 'join'>('create')

    const availableColors = multiUserDrawingService.getUserColors()
    const nameSuggestions = multiUserDrawingService.getUserNameSuggestions()

    const handleCreateSession = async () => {
        if (!userName.trim()) {
            Alert.alert('Name Required', 'Please enter your name to continue')
            return
        }

        try {
            const user: User = {
                id: multiUserDrawingService.generateUserId(),
                name: userName.trim(),
                color: selectedColor
            }

            const session = await multiUserDrawingService.createSession(user)
            Alert.alert(
                'Session Created!',
                `Your session ID is: ${session.id}\nShare this with others to join.`,
                [{ text: 'Start Drawing', onPress: () => router.push('/notebook-canvas-v2') }]
            )
        } catch (error) {
            Alert.alert('Error', 'Failed to create session. Please try again.')
        }
    }

    const handleJoinSession = async () => {
        if (!userName.trim()) {
            Alert.alert('Name Required', 'Please enter your name to continue')
            return
        }

        if (!sessionId.trim()) {
            Alert.alert('Session ID Required', 'Please enter a session ID to join')
            return
        }

        try {
            const user: User = {
                id: multiUserDrawingService.generateUserId(),
                name: userName.trim(),
                color: selectedColor
            }

            const session = await multiUserDrawingService.joinSession(sessionId.trim(), user)
            if (session) {
                Alert.alert(
                    'Joined Session!',
                    `You've joined the drawing session with ${session.users.length - 1} other${session.users.length === 2 ? '' : 's'}.`,
                    [{ text: 'Start Drawing', onPress: () => router.push('/notebook-canvas-v2') }]
                )
            } else {
                Alert.alert('Session Not Found', 'The session ID you entered could not be found.')
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to join session. Please try again.')
        }
    }

    const getRandomName = () => {
        const randomName = nameSuggestions[Math.floor(Math.random() * nameSuggestions.length)]
        setUserName(randomName)
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.push('/room')}>
                    <Feather name='arrow-left' size={18} color={colors.ink} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <Text style={styles.title}>Multi-User Drawing</Text>
                <Text style={styles.subtitle}>Draw together with others in real-time!</Text>

                {/* Mode Selection */}
                <View style={styles.modeSection}>
                    <TouchableOpacity 
                        style={[styles.modeButton, mode === 'create' && styles.selectedModeButton]}
                        onPress={() => setMode('create')}
                    >
                        <Feather name='plus-circle' size={20} color={mode === 'create' ? colors.paper : colors.ink} />
                        <Text style={[styles.modeButtonText, mode === 'create' && styles.selectedModeButtonText]}>
                            Create Session
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.modeButton, mode === 'join' && styles.selectedModeButton]}
                        onPress={() => setMode('join')}
                    >
                        <Feather name='users' size={20} color={mode === 'join' ? colors.paper : colors.ink} />
                        <Text style={[styles.modeButtonText, mode === 'join' && styles.selectedModeButtonText]}>
                            Join Session
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* User Setup */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Details</Text>
                    
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Your Name</Text>
                        <View style={styles.nameInputRow}>
                            <TextInput
                                style={styles.textInput}
                                value={userName}
                                onChangeText={setUserName}
                                placeholder="Enter your name"
                                placeholderTextColor={colors.inkSoft}
                                maxLength={20}
                            />
                            <TouchableOpacity style={styles.randomButton} onPress={getRandomName}>
                                <Feather name='shuffle' size={16} color={colors.ink} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Your Color</Text>
                        <View style={styles.colorGrid}>
                            {availableColors.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.colorSwatch,
                                        { backgroundColor: color },
                                        selectedColor === color && styles.selectedColorSwatch
                                    ]}
                                    onPress={() => setSelectedColor(color)}
                                >
                                    {selectedColor === color && (
                                        <Feather name='check' size={16} color='white' />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Session ID Input (for join mode) */}
                {mode === 'join' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Session Details</Text>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Session ID</Text>
                            <TextInput
                                style={styles.textInput}
                                value={sessionId}
                                onChangeText={setSessionId}
                                placeholder="Enter session ID"
                                placeholderTextColor={colors.inkSoft}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                    </View>
                )}

                {/* Action Button */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={mode === 'create' ? handleCreateSession : handleJoinSession}
                >
                    <Feather 
                        name={mode === 'create' ? 'plus-circle' : 'log-in'} 
                        size={20} 
                        color={colors.paper} 
                    />
                    <Text style={styles.actionButtonText}>
                        {mode === 'create' ? 'Create Session' : 'Join Session'}
                    </Text>
                </TouchableOpacity>

                {/* Info */}
                <View style={styles.infoBox}>
                    <Feather name='info' size={16} color={colors.ink} />
                    <Text style={styles.infoText}>
                        {mode === 'create' 
                            ? 'You\'ll get a session ID to share with others after creating.'
                            : 'Ask the session host for their session ID to join.'
                        }
                    </Text>
                </View>
            </View>
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
        padding: 20
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.ink,
        textAlign: 'center',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        color: colors.inkSoft,
        textAlign: 'center',
        marginBottom: 32
    },
    modeSection: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.stroke,
        backgroundColor: colors.paper
    },
    selectedModeButton: {
        backgroundColor: colors.ink,
        borderColor: colors.ink
    },
    modeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.ink
    },
    selectedModeButtonText: {
        color: colors.paper
    },
    section: {
        marginBottom: 24
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.ink,
        marginBottom: 16
    },
    inputContainer: {
        marginBottom: 16
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.ink,
        marginBottom: 8
    },
    nameInputRow: {
        flexDirection: 'row',
        gap: 8
    },
    textInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.stroke,
        backgroundColor: colors.paper,
        fontSize: 16,
        color: colors.ink
    },
    randomButton: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.stroke,
        backgroundColor: colors.paper,
        alignItems: 'center',
        justifyContent: 'center'
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    colorSwatch: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: colors.stroke,
        alignItems: 'center',
        justifyContent: 'center'
    },
    selectedColorSwatch: {
        borderColor: colors.ink,
        borderWidth: 3
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        backgroundColor: colors.ink,
        marginBottom: 20
    },
    actionButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.paper
    },
    infoBox: {
        flexDirection: 'row',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#f5f3ef',
        borderWidth: 1,
        borderColor: colors.stroke
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: colors.ink,
        lineHeight: 20
    }
})