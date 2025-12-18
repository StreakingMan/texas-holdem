import { ref, computed, onUnmounted } from 'vue'
import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import type { P2PMessage, MessageType } from '@/core/types'

export interface PeerState {
  peerId: string | null
  isConnected: boolean
  isHost: boolean
  connections: Map<string, DataConnection>
  error: string | null
}

type MessageHandler = (message: P2PMessage, senderId: string) => void

/**
 * PeerJS connection management composable
 */
export function usePeer() {
  const peer = ref<Peer | null>(null)
  const peerId = ref<string | null>(null)
  const isConnected = ref(false)
  const isHost = ref(false)
  const connections = ref<Map<string, DataConnection>>(new Map())
  const error = ref<string | null>(null)
  const messageHandlers = ref<Map<MessageType, MessageHandler[]>>(new Map())

  /**
   * Initialize peer connection
   */
  async function initPeer(customId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Create peer with optional custom ID
        peer.value = customId 
          ? new Peer(customId, { debug: 1 })
          : new Peer({ debug: 1 })

        peer.value.on('open', (id) => {
          peerId.value = id
          isConnected.value = true
          error.value = null
          console.log('[Peer] Connected with ID:', id)
          resolve(id)
        })

        peer.value.on('error', (err) => {
          console.error('[Peer] Error:', err)
          error.value = err.message
          
          if (err.type === 'unavailable-id') {
            reject(new Error('该房间ID已被使用'))
          } else if (err.type === 'peer-unavailable') {
            reject(new Error('无法连接到房间'))
          } else {
            reject(err)
          }
        })

        peer.value.on('connection', (conn) => {
          handleIncomingConnection(conn)
        })

        peer.value.on('disconnected', () => {
          console.log('[Peer] Disconnected from server')
          isConnected.value = false
        })

        peer.value.on('close', () => {
          console.log('[Peer] Connection closed')
          isConnected.value = false
          connections.value.clear()
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Create a room (become host)
   */
  async function createRoom(roomId: string): Promise<string> {
    const id = await initPeer(`room-${roomId}`)
    isHost.value = true
    return id
  }

  /**
   * Join an existing room
   */
  async function joinRoom(roomId: string): Promise<DataConnection> {
    await initPeer()
    
    return new Promise((resolve, reject) => {
      if (!peer.value) {
        reject(new Error('Peer not initialized'))
        return
      }

      const conn = peer.value.connect(`room-${roomId}`, {
        reliable: true,
        serialization: 'json'
      })

      conn.on('open', () => {
        console.log('[Peer] Connected to room:', roomId)
        connections.value.set(conn.peer, conn)
        setupConnectionHandlers(conn)
        resolve(conn)
      })

      conn.on('error', (err) => {
        console.error('[Peer] Connection error:', err)
        reject(err)
      })

      // Timeout for connection
      setTimeout(() => {
        if (!conn.open) {
          reject(new Error('连接超时'))
        }
      }, 10000)
    })
  }

  /**
   * Handle incoming connection (host only)
   */
  function handleIncomingConnection(conn: DataConnection): void {
    console.log('[Peer] Incoming connection from:', conn.peer)

    conn.on('open', () => {
      connections.value.set(conn.peer, conn)
      setupConnectionHandlers(conn)
    })

    conn.on('close', () => {
      connections.value.delete(conn.peer)
      // Notify about player leaving
      triggerHandler('player-leave', {
        type: 'player-leave',
        payload: { playerId: conn.peer },
        timestamp: Date.now(),
        senderId: conn.peer
      }, conn.peer)
    })

    conn.on('error', (err) => {
      console.error('[Peer] Connection error:', err)
      connections.value.delete(conn.peer)
    })
  }

  /**
   * Setup message handlers for a connection
   */
  function setupConnectionHandlers(conn: DataConnection): void {
    conn.on('data', (data) => {
      const message = data as P2PMessage
      console.log('[Peer] Received message:', message.type, 'from:', conn.peer)
      triggerHandler(message.type, message, conn.peer)
    })

    conn.on('close', () => {
      console.log('[Peer] Connection closed:', conn.peer)
      connections.value.delete(conn.peer)
    })
  }

  /**
   * Send message to a specific peer
   */
  function sendTo(peerId: string, message: Omit<P2PMessage, 'timestamp' | 'senderId'>): void {
    const conn = connections.value.get(peerId)
    if (conn && conn.open) {
      const fullMessage: P2PMessage = {
        ...message,
        timestamp: Date.now(),
        senderId: peer.value?.id || ''
      }
      conn.send(fullMessage)
    }
  }

  /**
   * Send message to host (for non-host players)
   */
  function sendToHost(message: Omit<P2PMessage, 'timestamp' | 'senderId'>): void {
    const hostConn = Array.from(connections.value.values())[0]
    if (hostConn && hostConn.open) {
      const fullMessage: P2PMessage = {
        ...message,
        timestamp: Date.now(),
        senderId: peer.value?.id || ''
      }
      hostConn.send(fullMessage)
    }
  }

  /**
   * Broadcast message to all connected peers
   */
  function broadcast(message: Omit<P2PMessage, 'timestamp' | 'senderId'>): void {
    const fullMessage: P2PMessage = {
      ...message,
      timestamp: Date.now(),
      senderId: peer.value?.id || ''
    }

    for (const conn of connections.value.values()) {
      if (conn.open) {
        conn.send(fullMessage)
      }
    }
  }

  /**
   * Register a message handler
   */
  function onMessage(type: MessageType, handler: MessageHandler): void {
    const handlers = messageHandlers.value.get(type) || []
    handlers.push(handler)
    messageHandlers.value.set(type, handlers)
  }

  /**
   * Remove a message handler
   */
  function offMessage(type: MessageType, handler: MessageHandler): void {
    const handlers = messageHandlers.value.get(type) || []
    const index = handlers.indexOf(handler)
    if (index !== -1) {
      handlers.splice(index, 1)
      messageHandlers.value.set(type, handlers)
    }
  }

  /**
   * Trigger handlers for a message type
   */
  function triggerHandler(type: MessageType, message: P2PMessage, senderId: string): void {
    const handlers = messageHandlers.value.get(type) || []
    for (const handler of handlers) {
      handler(message, senderId)
    }
  }

  /**
   * Get connected peer IDs
   */
  const connectedPeers = computed(() => Array.from(connections.value.keys()))

  /**
   * Disconnect and cleanup
   */
  function disconnect(): void {
    for (const conn of connections.value.values()) {
      conn.close()
    }
    connections.value.clear()
    
    if (peer.value) {
      peer.value.destroy()
      peer.value = null
    }
    
    peerId.value = null
    isConnected.value = false
    isHost.value = false
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    // State
    peer,
    peerId,
    isConnected,
    isHost,
    connections,
    connectedPeers,
    error,

    // Methods
    initPeer,
    createRoom,
    joinRoom,
    sendTo,
    sendToHost,
    broadcast,
    onMessage,
    offMessage,
    disconnect
  }
}

