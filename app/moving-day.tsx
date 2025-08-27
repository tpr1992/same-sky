import { Feather } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as MailComposer from 'expo-mail-composer'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Logo } from '../components/Logo'
import { PaperButton } from '../components/PaperButton'
import { colors } from '../theme'

export default function MovingDay() {
    const router = useRouter()
    const params = useLocalSearchParams<{ name?: string, city?: string, country?: string }>()
    const name = params.name || ''
    const city = params.city || ''
    const country = params.country || ''

    const [partnerEmail, setPartnerEmail] = useState('')

    const inviteCode = useMemo(() => makeInviteCode(), [])
    const inviteUrl = useMemo(() => `https://samesky.example/invite/${inviteCode}`, [inviteCode])

    const sendInvite = async () => {
        const email = partnerEmail.trim()
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            Alert.alert('Check email', 'Enter a valid partner email to send the invite')
            return
        }

        // Check if mail composer is available
        const isAvailable = await MailComposer.isAvailableAsync()
        if (!isAvailable) {
            Alert.alert('Email not available', 'Email is not available on this device')
            return
        }

        try {
            const result = await MailComposer.composeAsync({
                recipients: [email],
                subject: 'Join me on Same Sky! 🏠',
                body: `Hi there!\n\nYou've been invited to join me on Same Sky!\n\nClick this link to move in: ${inviteUrl}\n\nInvite code: ${inviteCode}\n\nLooking forward to sharing our virtual space together!\n\nBest regards`
            })

            if (result.status === 'sent') {
                Alert.alert('Email sent!', `Invite sent to ${email}`)
            } else if (result.status === 'cancelled') {
                // User cancelled, no need for an alert
            } else {
                Alert.alert('Email not sent', 'The email was not sent')
            }
        } catch (e) {
            Alert.alert('Could not send email', String(e))
        }
    }

    const copyLink = async () => {
        try {
            await Clipboard.setStringAsync(inviteUrl)
            Alert.alert('Copied', 'Invite link copied to clipboard')
        } catch (e) {
            Alert.alert('Copy failed', String(e))
        }
    }

    return (
        <SafeAreaView style={styles.paperScreen}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets={true}
            >
                <Logo size="lg" style={styles.logoWrap} />

                <Text style={styles.headingText}>
                    There is a person moving in with you right? Send them the address with this link.
                </Text>

                <View style={{ height: 10 }} />

                {/* Email input with icon */}
                <View style={styles.inputWithIcon}>
                    <Feather name='mail' size={18} color={colors.inkSoft} style={{ marginRight: 8 }} />
                    <TextInput
                        value={partnerEmail}
                        onChangeText={setPartnerEmail}
                        keyboardType='email-address'
                        autoCapitalize='none'
                        autoCorrect={false}
                        placeholder='partner@example.com'
                        placeholderTextColor='#8793a4'
                        style={styles.iconInput}
                    />
                </View>

                <View style={{ height: 12 }} />

                {/* Buttons */}
                <PaperButton title='Send invite' variant='filled' onPress={sendInvite} />
                <View style={{ height: 10 }} />
                <OutlineIconButton title='Copy link' icon='copy' onPress={copyLink} />

                <View style={{ height: 16 }} />

                {/* Optional: show the URL and code like your earlier mock */}
                <View style={styles.inviteCard}>
                    <Text style={{ color: colors.inkSoft, marginBottom: 4 }}>Your invite link</Text>
                    <Text numberOfLines={1} style={{ color: colors.ink }}>{inviteUrl}</Text>
                    <Text style={{ color: colors.inkSoft, marginTop: 8 }}>Code: {inviteCode}</Text>
                    {!!name && !!city && !!country && (
                        <Text style={{ color: colors.inkSoft, marginTop: 8 }}>
                            For {name} in {city}, {country} — welcome home
                        </Text>
                    )}
                </View>
                
                <View style={{ height: 12 }} />
                <TouchableOpacity onPress={() => router.push('/welcome')} style={styles.linkContainer}>
                    <Text style={styles.linkText}>Later</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    )
}

function OutlineIconButton(
    { title, icon, onPress }:
    { title: string, icon: 'copy' | 'mail' | 'link', onPress: () => void }
) {
    return (
        <TouchableOpacity
            accessibilityRole='button'
            style={[styles.btn, styles.btnOutline, styles.rowCenter]}
            onPress={onPress}
        >
            <Feather name={icon} size={18} color={colors.ink} style={{ marginRight: 8 }} />
            <Text style={[styles.btnText, styles.btnTextOutline]}>{title}</Text>
        </TouchableOpacity>
    )
}

function makeInviteCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let out = ''
    for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
    return out
}

const styles = StyleSheet.create({
    paperScreen: {
        flex: 1,
        backgroundColor: colors.paper
    },
    logoWrap: {
        marginTop: 24,
        marginBottom: 32
    },
    speechBubble: {
        color: colors.ink,
        fontSize: 20,
        lineHeight: 28,
        padding: 14,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: colors.stroke,
        backgroundColor: '#e8f0fa33'
    },
    headingText: {
        color: colors.ink,
        fontSize: 16,
        fontWeight: '600'
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fdfcf8',
        borderWidth: 2,
        borderColor: colors.stroke,
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 46
    },
    iconInput: {
        flex: 1,
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
    btn: {
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 16,
        minWidth: 220,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.ink
    },
    rowCenter: {
        flexDirection: 'row'
    },
    btnOutline: { backgroundColor: 'transparent' },
    btnText: { fontSize: 18, fontWeight: '700' },
    btnTextOutline: { color: colors.ink },
    inviteCard: {
        backgroundColor: '#fdfcf8',
        borderWidth: 2,
        borderColor: colors.stroke,
        borderRadius: 14,
        padding: 12
    }
})