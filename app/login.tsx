import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Logo } from '../components/Logo'
import { PaperButton } from '../components/PaperButton'
import { authService } from '../services/auth'
import { colors } from '../theme'

export default function Login() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [emailError, setEmailError] = useState('')
    const [passwordError, setPasswordError] = useState('')

    // in-app error modal state
    const [showErrorModal, setShowErrorModal] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [errorTitle, setErrorTitle] = useState('')

    const validateForm = () => {
        let ok = true
        setEmailError('')
        setPasswordError('')

        if (!email.trim()) {
            setEmailError('Email is required')
            ok = false
        } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
            setEmailError('Please enter a valid email address')
            ok = false
        }

        if (!password.trim()) {
            setPasswordError('Password is required')
            ok = false
        }

        return ok
    }

    const onLogin = async () => {
        if (isLoading) return
        if (!validateForm()) return

        setIsLoading(true)
        try {
            const result = await authService.login({
                email: email.trim(),
                password
            })

            if (result.success) {
                router.push('/welcome')
                return
            }

            const { title, message } = mapAuthError(result)
            setErrorTitle(title)
            setErrorMessage(message)
            setShowErrorModal(true)
        } catch (e) {
            setErrorTitle('Login error')
            setErrorMessage('Something went wrong. Please try again.')
            setShowErrorModal(true)
        } finally {
            setIsLoading(false)
        }
    }

    const onForgotPassword = () => {
        // You can route to /forgot when ready
        // router.push('/forgot')
        setShowErrorModal(false)
        // For now we just close the modal; the "Forgot password?" link below still exists
    }

    return (
        <SafeAreaView style={styles.paperScreen}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
                keyboardShouldPersistTaps='handled'
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets={true}
            >
                <Logo size='lg' style={styles.logoWrap} />

                <View style={styles.formWrap}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        value={email}
                        onChangeText={t => {
                            setEmail(t)
                            if (emailError) setEmailError('')
                        }}
                        keyboardType='email-address'
                        autoCapitalize='none'
                        autoCorrect={false}
                        placeholder='you@example.com'
                        placeholderTextColor='#8793a4'
                        style={[styles.input, emailError ? styles.inputError : null]}
                        returnKeyType='next'
                    />
                    {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        value={password}
                        onChangeText={t => {
                            setPassword(t)
                            if (passwordError) setPasswordError('')
                        }}
                        secureTextEntry
                        placeholder='Your password'
                        placeholderTextColor='#8793a4'
                        style={[styles.input, passwordError ? styles.inputError : null]}
                        returnKeyType='done'
                        onSubmitEditing={onLogin}
                    />
                    {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

                    <View style={{ height: 16 }} />

                    <PaperButton
                        title={isLoading ? 'Logging in...' : 'Log in'}
                        variant='filled'
                        onPress={onLogin}
                        disabled={isLoading}
                    />

                    <View style={{ height: 16 }} />

                    <TouchableOpacity onPress={onForgotPassword} style={styles.linkContainer}>
                        <Text style={styles.linkText}>Forgot password?</Text>
                    </TouchableOpacity>

                    <View style={{ height: 8 }} />

                    <TouchableOpacity onPress={() => router.push('/welcome')} style={styles.linkContainer}>
                        <Text style={styles.linkText}>Skip</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* In-app error modal */}
            <Modal
                visible={showErrorModal}
                transparent
                animationType='fade'
                onRequestClose={() => setShowErrorModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowErrorModal(false)}>
                    <Pressable style={styles.dialog} onPress={e => e.stopPropagation()}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowErrorModal(false)}>
                            <Feather name='x' size={24} color={colors.ink} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>{errorTitle || 'Login failed'}</Text>
                        <Text style={styles.modalMessage}>{errorMessage}</Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnOutline]}
                                onPress={() => setShowErrorModal(false)}
                            >
                                <Text style={[styles.modalBtnText, styles.modalBtnTextOutline]}>OK</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

        </SafeAreaView>
    )
}

/* -------- helpers -------- */

function mapAuthError(result: any): { title: string, message: string } {
    const raw = String(result?.code || result?.error || '').toLowerCase()

    if (
        raw.includes('email_not_found') ||
        raw.includes('user-not-found') ||
        raw.includes('no user') ||
        raw.includes('not found')
    ) {
        return {
            title: 'Email not found',
            message: 'We couldn’t find an account for that email. Double-check the address or register.'
        }
    }

    if (
        raw.includes('wrong_password') ||
        raw.includes('invalid-password') ||
        raw.includes('incorrect password') ||
        raw.includes('bad credentials')
    ) {
        return {
            title: 'Incorrect password',
            message: 'That password doesn’t look right. You can try again or reset it.'
        }
    }

    return {
        title: 'Login failed',
        message: typeof result?.error === 'string' && result.error
            ? result.error
            : 'Please check your credentials and try again.'
    }
}

/* -------- styles -------- */

const styles = StyleSheet.create({
    paperScreen: {
        flex: 1,
        backgroundColor: colors.paper
    },
    logoWrap: {
        marginTop: 24,
        marginBottom: 48
    },
    formWrap: {
        marginTop: 8
    },
    label: {
        marginTop: 12,
        marginBottom: 6,
        color: colors.inkSoft,
        fontWeight: '600'
    },
    input: {
        backgroundColor: '#fdfcf8',
        borderWidth: 2,
        borderColor: colors.stroke,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.ink
    },
    linkContainer: {
        alignItems: 'center',
        paddingVertical: 8
    },
    linkText: {
        color: colors.inkSoft,
        fontSize: 16,
        fontWeight: '600',
        textDecorationLine: 'underline'
    },
    inputError: {
        borderColor: '#dc3545',
        borderWidth: 2
    },
    errorText: {
        color: '#dc3545',
        fontSize: 14,
        marginTop: 4,
        marginBottom: 8,
        fontStyle: 'italic'
    },

    /* modal styling mirrors the room page */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(39, 76, 119, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    dialog: {
        backgroundColor: colors.paper,
        borderRadius: 16,
        borderWidth: 3,
        borderColor: colors.stroke,
        padding: 24,
        width: '100%',
        maxWidth: 340,
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
        fontSize: 22,
        fontWeight: '700',
        color: colors.ink,
        textAlign: 'center',
        marginBottom: 8,
        fontStyle: 'italic',
        transform: [{ rotate: '0.5deg' }]
    },
    modalMessage: {
        color: colors.inkSoft,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 16
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row'
    },
    modalBtnOutline: {
        backgroundColor: colors.paper,
        borderColor: colors.stroke
    },
    modalBtnFilled: {
        backgroundColor: colors.accent,
        borderColor: colors.accent
    },
    modalBtnText: {
        fontSize: 16,
        fontWeight: '700'
    },
    modalBtnTextOutline: {
        color: colors.ink
    },
    modalBtnTextFilled: {
        color: '#fff'
    }
})
