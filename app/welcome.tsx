import { useRouter } from 'expo-router'
import React, { useRef } from 'react'
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { colors } from '../theme'

export default function Welcome() {
    const router = useRouter()
    const opacity = useRef(new Animated.Value(1)).current

    const goNext = () => {
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true })
            .start(() => router.replace('/room'))
    }

    return (
        <SafeAreaView style={styles.paperScreen}>
            <Animated.View style={[styles.container, { opacity }]}>
                <Pressable style={styles.centerWrap} onPress={goNext}>
                    <Text style={styles.greetingText}>Céad míle fáilte</Text>
                    <Text style={styles.subText}>Tap anywhere to enter</Text>
                </Pressable>
            </Animated.View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    paperScreen: { flex: 1, backgroundColor: colors.paper },
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
    centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    greetingText: {
        fontSize: 48, color: colors.ink, fontWeight: '300', textAlign: 'center', marginBottom: 16,
        fontStyle: 'italic', letterSpacing: 1, lineHeight: 58, textShadowColor: 'rgba(39,76,119,0.15)',
        textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 3, transform: [{ rotate: '-1deg' }]
    },
    subText: { fontSize: 18, color: colors.inkSoft, fontStyle: 'italic', textAlign: 'center' }
})
