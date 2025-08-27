import { Stack } from 'expo-router'
import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const paper = '#fcf7ee'

export default function Layout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: paper },
                    animation: 'fade'
                }}
            >
                <Stack.Screen 
                    name="notebook-canvas"
                    options={{
                        gestureEnabled: false
                    }}
                />
            </Stack>
        </GestureHandlerRootView>
    )
}