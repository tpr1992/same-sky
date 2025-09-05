import AsyncStorage from '@react-native-async-storage/async-storage'

export type DrawingSession = {
  id: string
  currentTurn: string
  users: {
    id: string
    name: string
    color: string
    joinedAt: number
  }[]
  drawingData?: string
  lastModified: number
  turnHistory: {
    userId: string
    timestamp: number
    action: 'draw' | 'join' | 'leave'
  }[]
}

export type User = {
  id: string
  name: string
  color: string
}

class MultiUserDrawingService {
  private currentSession: DrawingSession | null = null
  private currentUser: User | null = null
  private listeners: ((session: DrawingSession) => void)[] = []

  // Generate a simple user ID
  generateUserId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9)
  }

  // Generate session ID
  generateSessionId(): string {
    return 'session_' + Math.random().toString(36).substr(2, 9)
  }

  // Set current user
  setCurrentUser(user: User) {
    this.currentUser = user
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }

  // Create a new drawing session
  async createSession(hostUser: User): Promise<DrawingSession> {
    const session: DrawingSession = {
      id: this.generateSessionId(),
      currentTurn: hostUser.id,
      users: [{ ...hostUser, joinedAt: Date.now() }],
      lastModified: Date.now(),
      turnHistory: [{
        userId: hostUser.id,
        timestamp: Date.now(),
        action: 'join'
      }]
    }

    this.currentSession = session
    this.currentUser = hostUser
    await this.saveSession(session)
    this.notifyListeners(session)
    
    return session
  }

  // Join an existing session
  async joinSession(sessionId: string, user: User): Promise<DrawingSession | null> {
    const session = await this.loadSession(sessionId)
    if (!session) return null

    // Add user if not already in session
    const existingUser = session.users.find(u => u.id === user.id)
    if (!existingUser) {
      session.users.push({ ...user, joinedAt: Date.now() })
      session.turnHistory.push({
        userId: user.id,
        timestamp: Date.now(),
        action: 'join'
      })
      session.lastModified = Date.now()
    }

    this.currentSession = session
    this.currentUser = user
    await this.saveSession(session)
    this.notifyListeners(session)
    
    return session
  }

  // Check if it's current user's turn
  isMyTurn(): boolean {
    return this.currentSession?.currentTurn === this.currentUser?.id
  }

  // End current user's turn and pass to next user
  async endTurn(): Promise<void> {
    if (!this.currentSession || !this.currentUser) return

    const currentIndex = this.currentSession.users.findIndex(u => u.id === this.currentUser!.id)
    const nextIndex = (currentIndex + 1) % this.currentSession.users.length
    const nextUser = this.currentSession.users[nextIndex]

    this.currentSession.currentTurn = nextUser.id
    this.currentSession.lastModified = Date.now()
    this.currentSession.turnHistory.push({
      userId: this.currentUser.id,
      timestamp: Date.now(),
      action: 'draw'
    })

    await this.saveSession(this.currentSession)
    this.notifyListeners(this.currentSession)
  }

  // Save drawing data to session
  async saveDrawingData(drawingData: string): Promise<void> {
    if (!this.currentSession) return

    this.currentSession.drawingData = drawingData
    this.currentSession.lastModified = Date.now()
    
    await this.saveSession(this.currentSession)
    this.notifyListeners(this.currentSession)
  }

  // Get current session
  getCurrentSession(): DrawingSession | null {
    return this.currentSession
  }

  // Load session from storage
  private async loadSession(sessionId: string): Promise<DrawingSession | null> {
    try {
      const sessionData = await AsyncStorage.getItem(`drawing_session_${sessionId}`)
      return sessionData ? JSON.parse(sessionData) : null
    } catch (error) {
      console.error('Error loading session:', error)
      return null
    }
  }

  // Save session to storage
  private async saveSession(session: DrawingSession): Promise<void> {
    try {
      await AsyncStorage.setItem(`drawing_session_${session.id}`, JSON.stringify(session))
    } catch (error) {
      console.error('Error saving session:', error)
    }
  }

  // Get available user colors
  getUserColors(): string[] {
    return [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#96CEB4', // Green
      '#FFEAA7', // Yellow
      '#DDA0DD', // Plum
      '#FFB347', // Orange
      '#87CEEB', // Sky Blue
    ]
  }

  // Generate user name suggestions
  getUserNameSuggestions(): string[] {
    return [
      'Artist', 'Sketcher', 'Painter', 'Drawer', 'Creator',
      'Doodler', 'Designer', 'Illustrator', 'Craftsman', 'Maker'
    ]
  }

  // Subscribe to session updates
  subscribe(listener: (session: DrawingSession) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  // Notify all listeners
  private notifyListeners(session: DrawingSession) {
    this.listeners.forEach(listener => listener(session))
  }

  // Leave current session
  async leaveSession(): Promise<void> {
    if (!this.currentSession || !this.currentUser) return

    const session = this.currentSession
    session.users = session.users.filter(u => u.id !== this.currentUser!.id)
    session.turnHistory.push({
      userId: this.currentUser.id,
      timestamp: Date.now(),
      action: 'leave'
    })

    // If leaving user was current turn, pass to next user
    if (session.currentTurn === this.currentUser.id && session.users.length > 0) {
      session.currentTurn = session.users[0].id
    }

    session.lastModified = Date.now()
    await this.saveSession(session)
    
    this.currentSession = null
    this.currentUser = null
  }

  // List all available sessions (for development/testing)
  async listSessions(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys()
      return keys.filter(key => key.startsWith('drawing_session_'))
                 .map(key => key.replace('drawing_session_', ''))
    } catch (error) {
      console.error('Error listing sessions:', error)
      return []
    }
  }

  // Clear all sessions (for development/testing)
  async clearAllSessions(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys()
      const sessionKeys = keys.filter(key => key.startsWith('drawing_session_'))
      await AsyncStorage.multiRemove(sessionKeys)
    } catch (error) {
      console.error('Error clearing sessions:', error)
    }
  }
}

export const multiUserDrawingService = new MultiUserDrawingService()