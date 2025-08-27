import AsyncStorage from '@react-native-async-storage/async-storage'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  dateOfBirth: Date
  country: string
  partnerTimezone: string
  createdAt: Date
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  dateOfBirth: Date
  country: string
}

const STORAGE_KEYS = {
  USERS: '@same_sky_users',
  CURRENT_USER: '@same_sky_current_user'
}

class AuthService {
  // Create a new user account
  async register(data: RegisterData): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Check if email already exists
      const existingUsers = await this.getAllUsers()
      const emailExists = existingUsers.some(user => user.email.toLowerCase() === data.email.toLowerCase())
      
      if (emailExists) {
        return { success: false, error: 'Email already exists' }
      }

      // Create new user
      const newUser: User = {
        id: Date.now().toString(),
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        country: data.country,
        partnerTimezone: 'America/New_York', // Default for testing
        createdAt: new Date()
      }

      // Store password separately (simple hash for POC)
      const hashedPassword = this.simpleHash(data.password)
      
      // Save user and password
      await this.saveUser(newUser, hashedPassword)
      await this.setCurrentUser(newUser)

      return { success: true, user: newUser }
    } catch (error) {
      return { success: false, error: 'Registration failed' }
    }
  }

  // Login with email and password
  async login(credentials: LoginCredentials): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const users = await this.getAllUsers()
      const user = users.find(u => u.email.toLowerCase() === credentials.email.toLowerCase())
      
      if (!user) {
        return { success: false, error: 'Email not found' }
      }

      // Check password
      const storedPassword = await AsyncStorage.getItem(`@same_sky_password_${user.id}`)
      const hashedPassword = this.simpleHash(credentials.password)
      
      if (storedPassword !== hashedPassword) {
        return { success: false, error: 'Incorrect password' }
      }

      await this.setCurrentUser(user)
      return { success: true, user }
    } catch (error) {
      return { success: false, error: 'Login failed' }
    }
  }

  // Get current logged in user
  async getCurrentUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER)
      return userData ? JSON.parse(userData) : null
    } catch (error) {
      return null
    }
  }

  // Logout current user
  async logout(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
  }

  // Private helper methods
  private async getAllUsers(): Promise<User[]> {
    try {
      const usersData = await AsyncStorage.getItem(STORAGE_KEYS.USERS)
      return usersData ? JSON.parse(usersData) : []
    } catch (error) {
      return []
    }
  }

  private async saveUser(user: User, hashedPassword: string): Promise<void> {
    // Save user to users list
    const users = await this.getAllUsers()
    users.push(user)
    await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users))
    
    // Save password separately
    await AsyncStorage.setItem(`@same_sky_password_${user.id}`, hashedPassword)
  }

  private async setCurrentUser(user: User): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user))
  }

  private simpleHash(password: string): string {
    // Simple hash for POC - in production use proper crypto
    let hash = 0
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }

  // Development helper - create test accounts
  async createTestAccounts(): Promise<void> {
    const testAccounts = [
      {
        email: 'you@samesky.test',
        password: 'password123',
        firstName: 'Your',
        lastName: 'Name',
        dateOfBirth: new Date('1990-06-15'),
        country: 'Ireland'
      },
      {
        email: 'partner@samesky.test',
        password: 'password123',
        firstName: 'Partner',
        lastName: 'Name',
        dateOfBirth: new Date('1992-03-22'),
        country: 'United States'
      }
    ]

    for (const account of testAccounts) {
      await this.register(account)
    }
  }

  // Development helper - clear all data
  async clearAllData(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USERS,
      STORAGE_KEYS.CURRENT_USER
    ])
    
    // Clear all password keys
    const keys = await AsyncStorage.getAllKeys()
    const passwordKeys = keys.filter(key => key.startsWith('@same_sky_password_'))
    await AsyncStorage.multiRemove(passwordKeys)
  }
}

export const authService = new AuthService()