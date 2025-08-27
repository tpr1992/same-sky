// This file is no longer used as the main entry point.
// The app now uses Expo Router with separate files in the app/ directory:
// - app/index.tsx (Splash screen)  
// - app/register.tsx (Registration form)
// - app/moving-day.tsx (Moving day screen - to be created)

import React from 'react'
import { Text, View } from 'react-native'

export default function App() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>This App.tsx is no longer used. Using Expo Router instead.</Text>
        </View>
    )
}