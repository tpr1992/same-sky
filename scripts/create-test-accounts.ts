import { authService } from '../services/auth'

// Script to create test accounts for development
// This can be run from the main app during development

export async function createTestAccounts() {
  console.log('Creating test accounts...')

  try {
    // Clear existing data first
    await authService.clearAllData()
    console.log('Cleared existing data')

    // Create your account (Ireland)
    const yourAccount = await authService.register({
      email: 'terence@samesky.test',
      password: 'pass',
      firstName: 'Terence',
      lastName: 'Patane-Ronan',
      dateOfBirth: new Date('1992-09-27'),
      country: 'Ireland'
    })

    if (yourAccount.success) {
      console.log('✓ Created your account (terence@samesky.test)')
    } else {
      console.log('✗ Failed to create your account:', yourAccount.error)
    }

    // Create partner account (USA/New York)
    const partnerAccount = await authService.register({
      email: 'lauren@samesky.test',
      password: 'pass',
      firstName: 'Lauren',
      lastName: 'Bradley Clarke',
      dateOfBirth: new Date('1996-07-28'),
      country: 'United States'
    })

    if (partnerAccount.success) {
      console.log('✓ Created partner account (lauren@samesky.test)')
    } else {
      console.log('✗ Failed to create partner account:', partnerAccount.error)
    }

    console.log('\n📝 Test Account Credentials:')
    console.log('Your Account:')
    console.log('  Email: terence@samesky.test')
    console.log('  Password: pass')
    console.log('\nPartner Account:')
    console.log('  Email: lauren@samesky.test')
    console.log('  Password: pass')

  } catch (error) {
    console.error('Error creating test accounts:', error)
  }
}