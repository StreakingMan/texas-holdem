import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePlayerStore = defineStore('player', () => {
  // Local player info
  const playerId = ref<string>('')
  const playerName = ref<string>('')
  const avatar = ref<string>('')

  // Connection state
  const isConnected = ref(false)
  const isHost = ref(false)
  const roomId = ref<string>('')

  // Computed
  const isInRoom = computed(() => !!roomId.value)

  /**
   * Set player info
   */
  function setPlayerInfo(name: string, avatarUrl?: string): void {
    playerName.value = name
    if (avatarUrl) {
      avatar.value = avatarUrl
    }
    // Always generate a new unique ID to ensure each tab/session has its own ID
    playerId.value = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Set room connection info
   */
  function setRoomInfo(id: string, host: boolean): void {
    roomId.value = id
    isHost.value = host
    isConnected.value = true
  }

  /**
   * Clear room connection
   */
  function clearRoom(): void {
    roomId.value = ''
    isHost.value = false
    isConnected.value = false
  }

  /**
   * Load saved player info from localStorage
   */
  function loadSavedInfo(): void {
    const saved = localStorage.getItem('texas-holdem-player')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        playerName.value = data.name || ''
        avatar.value = data.avatar || ''
        playerId.value = data.id || ''
      } catch {
        // Ignore parse errors
      }
    }
  }

  /**
   * Save player info to localStorage
   */
  function saveInfo(): void {
    localStorage.setItem('texas-holdem-player', JSON.stringify({
      name: playerName.value,
      avatar: avatar.value,
      id: playerId.value
    }))
  }

  return {
    // State
    playerId,
    playerName,
    avatar,
    isConnected,
    isHost,
    roomId,
    isInRoom,

    // Actions
    setPlayerInfo,
    setRoomInfo,
    clearRoom,
    loadSavedInfo,
    saveInfo
  }
})

