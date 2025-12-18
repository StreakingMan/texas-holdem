import { ref, computed } from 'vue'
import type { ChatMessage, P2PMessage } from '@/core/types'

/**
 * Chat functionality composable
 */
export function useChat(playerId: string, playerName: string, playerAvatar?: string) {
  const messages = ref<ChatMessage[]>([])
  const maxMessages = 100 // Keep last 100 messages

  /**
   * Add a message to chat
   */
  function addMessage(message: ChatMessage): void {
    messages.value.push(message)
    
    // Trim old messages
    if (messages.value.length > maxMessages) {
      messages.value = messages.value.slice(-maxMessages)
    }
  }

  /**
   * Create a new message
   */
  function createMessage(content: string): ChatMessage {
    return {
      id: `${playerId}-${Date.now()}`,
      playerId,
      playerName,
      playerAvatar,
      content,
      timestamp: Date.now()
    }
  }

  /**
   * Handle incoming chat message from P2P
   */
  function handleChatMessage(message: P2PMessage): void {
    const chatMessage = message.payload as ChatMessage
    addMessage(chatMessage)
  }

  /**
   * Format timestamp for display
   */
  function formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  /**
   * Clear all messages
   */
  function clearMessages(): void {
    messages.value = []
  }

  /**
   * Get sorted messages (newest last)
   */
  const sortedMessages = computed(() => 
    [...messages.value].sort((a, b) => a.timestamp - b.timestamp)
  )

  /**
   * Add system message
   */
  function addSystemMessage(content: string): void {
    addMessage({
      id: `system-${Date.now()}`,
      playerId: 'system',
      playerName: '系统',
      content,
      timestamp: Date.now()
    })
  }

  return {
    // State
    messages: sortedMessages,

    // Methods
    addMessage,
    createMessage,
    handleChatMessage,
    formatTime,
    clearMessages,
    addSystemMessage
  }
}

