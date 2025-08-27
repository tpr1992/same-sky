import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { Alert, FlatList, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { PaperButton } from '../components/PaperButton'
import { Logo } from '../components/Logo'
import { colors } from '../theme'
import { authService } from '../services/auth'

const COUNTRY_LIST = [
    'Ireland', 'United States', 'United Kingdom', 'Canada',
    'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands'
]

function IOSWheelDatePicker(
    { value, onChange, maximumDate }:
    { value: Date, onChange: (d: Date) => void, maximumDate?: Date }
) {
    return (
        <DateTimePicker
            value={value}
            mode='date'
            display='spinner'          // iOS wheel picker
            maximumDate={maximumDate}
            onChange={(e, date) => {
                if (date) onChange(date)
            }}
            themeVariant='light'
            style={{ width: '100%' }}
        />
    )
}

function fmtDate(d: Date) {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd} / ${mm} / ${yyyy}`
}

export default function Register() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [dob, setDob] = useState<Date | null>(null)
    const [country, setCountry] = useState('Ireland')
    const [showCountries, setShowCountries] = useState(false)
    const [showDob, setShowDob] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const isValid = useMemo(() => {
        if (!email.trim() || !firstName.trim() || !lastName.trim() || !country.trim()) return false
        if (!password || !confirmPassword) return false
        if (password !== confirmPassword) return false
        if (password.length < 6) return false
        if (!dob) return false
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) return false
        return true
    }, [email, firstName, lastName, password, confirmPassword, country, dob])

    const onContinue = async () => {
        if (!isValid || isLoading) return
        
        setIsLoading(true)
        try {
            const result = await authService.register({
                email: email.trim(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                password,
                dateOfBirth: dob!,
                country: country.trim()
            })

            if (result.success) {
                Alert.alert('Success', 'Account created successfully!', [
                    { text: 'OK', onPress: () => router.push('/welcome-new-user') }
                ])
            } else {
                Alert.alert('Registration Failed', result.error || 'Please try again')
            }
        } catch (error) {
            Alert.alert('Error', 'Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
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
                
                <Text style={styles.detailsBubble}>We just need a few details before you move in…</Text>

                <View style={styles.formWrap}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        keyboardType='email-address'
                        autoCapitalize='none'
                        autoCorrect={false}
                        placeholder='you@example.com'
                        placeholderTextColor='#8793a4'
                        style={styles.input}
                    />

                    <Text style={styles.label}>First Name</Text>
                    <TextInput
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder='First name'
                        placeholderTextColor='#8793a4'
                        style={styles.input}
                        autoCapitalize='words'
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>Last Name</Text>
                    <TextInput
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder='Last name'
                        placeholderTextColor='#8793a4'
                        style={styles.input}
                        autoCapitalize='words'
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={true}
                        placeholder='At least 6 characters'
                        placeholderTextColor='#8793a4'
                        style={styles.input}
                        returnKeyType="next"
                        onSubmitEditing={() => {
                            // Focus next field or dismiss keyboard
                        }}
                    />

                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={true}
                        placeholder='Confirm your password'
                        placeholderTextColor='#8793a4'
                        style={styles.input}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                            // Dismiss keyboard when done
                        }}
                    />

                    <Text style={styles.label}>Date of birth</Text>
                    <TouchableOpacity
                        onPress={() => setShowDob(true)}
                        activeOpacity={0.6}
                        style={[styles.input, { justifyContent: 'center' }]}
                    >
                        <Text style={{ color: dob ? colors.ink : '#8793a4', fontSize: 16 }}>
                            {dob ? fmtDate(dob) : 'DD / MM / YYYY'}
                        </Text>
                    </TouchableOpacity>

                    <Text style={styles.label}>Country</Text>
                    <TouchableOpacity onPress={() => setShowCountries(true)} activeOpacity={0.8}>
                        <View pointerEvents='none'>
                            <TextInput value={country} editable={false} style={styles.input} />
                        </View>
                    </TouchableOpacity>

                    <View style={{ height: 8 }} />
                    <PaperButton 
                        title={isLoading ? 'Creating Account...' : 'Create Account'} 
                        variant='filled' 
                        onPress={onContinue}
                        disabled={!isValid || isLoading}
                    />
                </View>
            </ScrollView>

            <Modal visible={showCountries} transparent animationType='fade'>
                <View style={styles.modalShade}>
                    <View style={styles.modalCard}>
                        <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Select country</Text>
                        <FlatList
                            data={COUNTRY_LIST}
                            keyExtractor={item => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.countryRow} onPress={() => {
                                    setCountry(item)
                                    setShowCountries(false)
                                }}>
                                    <Text style={{ color: colors.ink }}>{item}</Text>
                                    {item === country && <Text style={{ color: colors.ink }}>  ✓</Text>}
                                </TouchableOpacity>
                            )}
                            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                        />
                        <View style={{ height: 12 }} />
                        <PaperButton title='Close' variant='outline' onPress={() => setShowCountries(false)} />
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showDob}
                transparent
                animationType='fade'
                presentationStyle='overFullScreen'
                onRequestClose={() => setShowDob(false)}
            >
                <View style={styles.sheetBackdrop}>
                    {/* tap outside to dismiss */}
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowDob(false)} />

                    <View style={styles.sheet}>
                        <View style={styles.grabber} />

                        <View style={styles.sheetHeader}>
                            <TouchableOpacity onPress={() => setShowDob(false)}>
                                <Text style={styles.sheetAction}>Cancel</Text>
                            </TouchableOpacity>

                            <Text style={styles.sheetTitle}>Select your date of birth</Text>

                            <TouchableOpacity onPress={() => setShowDob(false)}>
                                <Text style={styles.sheetAction}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        {Platform.OS === 'ios' ? (
                            <IOSWheelDatePicker
                                value={dob || new Date(2000, 0, 1)}
                                maximumDate={new Date()}
                                onChange={(d) => setDob(d)}
                            />
                        ) : (
                            <DateTimePicker
                                value={dob || new Date(2000, 0, 1)}
                                mode='date'
                                display='default'
                                maximumDate={new Date()}
                                onChange={(e, date) => {
                                    setShowDob(false)
                                    if (date) setDob(date)
                                }}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    )
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
    detailsBubble: {
        color: colors.ink,
        fontSize: 20,
        lineHeight: 28,
        padding: 14,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: colors.stroke,
        backgroundColor: '#e8f0fa33',
        marginBottom: 10
    },
    formWrap: { marginTop: 6 },
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
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        fontSize: 16,
        color: colors.ink
    },
    modalShade: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    modalCard: {
        width: '100%',
        maxHeight: '70%',
        borderRadius: 16,
        backgroundColor: colors.paper,
        padding: 16,
        borderWidth: 2,
        borderColor: colors.stroke
    },
    countryRow: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#fdfcf8',
        borderWidth: 1,
        borderColor: '#e1d9c9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    sheetBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-end'
    },
    sheet: {
        backgroundColor: colors.paper,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 2,
        borderLeftWidth: 2,
        borderRightWidth: 2,
        borderColor: colors.stroke,
        paddingBottom: 24,
        paddingHorizontal: 16,
        paddingTop: 8
    },
    grabber: {
        alignSelf: 'center',
        width: 44,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#d8d2c6',
        marginBottom: 8
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6
    },
    sheetTitle: {
        color: colors.ink,
        fontWeight: '700'
    },
    sheetAction: {
        color: colors.inkSoft,
        fontWeight: '600'
    }
})