import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { colors } from '../theme'

export function PaperButton(
    { title, variant, onPress }:
    { title: string, variant: 'filled' | 'outline', onPress: () => void }
) {
    return (
        <TouchableOpacity
            accessibilityRole='button'
            style={[styles.btn, variant === 'filled' ? styles.btnFilled : styles.btnOutline]}
            onPress={onPress}
        >
            <Text style={[styles.btnText, variant === 'filled' ? styles.btnTextFilled : styles.btnTextOutline]}>
                {title}
            </Text>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
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
    btnOutline: { backgroundColor: 'transparent' },
    btnFilled: {
        backgroundColor: colors.accent,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4
    },
    btnText: { fontSize: 18, fontWeight: '700' },
    btnTextOutline: { color: colors.ink },
    btnTextFilled: { color: '#fff' }
})