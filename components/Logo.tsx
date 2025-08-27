import React from 'react'
import { View, Text, StyleSheet, ViewStyle, Platform } from 'react-native'
import { colors } from '../theme'

export function Logo({ size = 'lg', style }:
    { size?: 'lg' | 'md' | 'sm', style?: ViewStyle }
) {
    const fontSize = size === 'lg' ? 56 : size === 'md' ? 44 : 34
    return (
        <View style={[styles.wrap, style]}>
            <Text style={[styles.line, { fontSize }]}>Same</Text>
            <Text style={[styles.line, { fontSize, marginTop: -6 }]}>Sky</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    wrap: { 
        alignItems: 'center', 
        justifyContent: 'center',
        transform: [{ rotate: '-1deg' }]
    },
    line: {
        color: colors.ink,
        fontWeight: '300',
        letterSpacing: 1,
        fontStyle: 'italic',
        textShadowColor: 'rgba(39,76,119,0.15)',
        textShadowOffset: { width: 1, height: 2 },
        textShadowRadius: 3,
        fontFamily: Platform.OS === 'ios' ? 'Marker Felt' : 'sans-serif-condensed'
    }
})