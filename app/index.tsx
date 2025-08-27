import React from 'react'
import { SafeAreaView, View, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { PaperButton } from '../components/PaperButton'
import { Logo } from '../components/Logo'
import { colors } from '../theme'
import { createTestAccounts } from '../scripts/create-test-accounts'

export default function Splash() {
    const router = useRouter()

    const handleCreateTestAccounts = async () => {
        try {
            await createTestAccounts()
            Alert.alert(
                'Test Accounts Created!',
                'Two test accounts have been created:\n\n' +
                '• terence@samesky.test (password: pass)\n' +
                '• lauren@samesky.test (password: pass)\n\n' +
                'You can now log in with either account.',
                [{ text: 'OK' }]
            )
        } catch (error) {
            Alert.alert('Error', 'Failed to create test accounts')
        }
    }

    return (
        <SafeAreaView style={styles.paperScreen}>
            <View style={styles.centerWrap}>
                <Logo size="lg" />

                <View style={styles.spacer24} />

                <PaperButton title='Log in' variant='outline' onPress={() => router.push('/login')} />
                <View style={styles.spacer12} />
                <PaperButton title='Register' variant='filled' onPress={() => router.push('/register')} />
                
                {/* Temporarily hidden - uncomment to restore test account creation
                <View style={styles.spacer24} />
                <PaperButton 
                    title='Create Test Accounts (Dev)' 
                    variant='outline' 
                    onPress={handleCreateTestAccounts}
                    style={{ backgroundColor: '#f0f0f0' }}
                />
                */}
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    paperScreen: {
        flex: 1,
        backgroundColor: colors.paper
    },
    centerWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24
    },
    spacer24: { height: 24 },
    spacer12: { height: 12 }
})