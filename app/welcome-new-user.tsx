import { useRouter } from 'expo-router'
import React, { useRef, useEffect, useState } from 'react'
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { colors } from '../theme'
import { authService } from '../services/auth'

export default function WelcomeNewUser() {
    const router = useRouter()
    const opacity = useRef(new Animated.Value(1)).current
    const [userName, setUserName] = useState('')

    useEffect(() => {
        // Get the current user's name
        const getCurrentUser = async () => {
            const user = await authService.getCurrentUser()
            if (user) {
                setUserName(user.firstName)
            }
        }
        getCurrentUser()
    }, [])

    const goNext = () => {
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true })
            .start(() => router.replace('/moving-day'))
    }

    return (
        <SafeAreaView style={styles.paperScreen}>
            <Animated.View style={[styles.container, { opacity }]}>
                <Pressable style={styles.centerWrap} onPress={goNext}>
                    <Text style={styles.welcomeText}>
                        Perfect! Good to have you {userName}. You seem like the right sort.
                    </Text>
                    <Text style={styles.subText}>Tap anywhere to continue</Text>
                </Pressable>
            </Animated.View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    paperScreen: { flex: 1, backgroundColor: colors.paper },
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
    centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    welcomeText: {
        fontSize: 32, color: colors.ink, fontWeight: '400', textAlign: 'center', marginBottom: 24,
        fontStyle: 'italic', letterSpacing: 0.5, lineHeight: 42, textShadowColor: 'rgba(39,76,119,0.1)',
        textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 3, transform: [{ rotate: '-0.5deg' }]
    },
    subText: { fontSize: 18, color: colors.inkSoft, fontStyle: 'italic', textAlign: 'center' }
})