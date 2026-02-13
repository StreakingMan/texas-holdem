import { ref, computed, onUnmounted } from "vue";
import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import type { P2PMessage, MessageType } from "@/core/types";

// Metered TURN 服务 API Key
// 获取方式：https://www.metered.ca/stun-turn
const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY || "";
const METERED_APP_NAME = import.meta.env.VITE_METERED_APP_NAME || "";

// 默认 ICE 服务器（备用，当无法获取 Metered 凭据时使用）
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.qq.com:3478" },
  { urls: "stun:stun.miwifi.com:3478" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/**
 * 从 Metered API 获取 TURN 服务器凭据
 */
async function fetchMeteredIceServers(): Promise<RTCIceServer[]> {
  if (!METERED_API_KEY || !METERED_APP_NAME) {
    console.log("[ICE] Metered 未配置，使用默认 STUN 服务器");
    return DEFAULT_ICE_SERVERS;
  }

  try {
    const response = await fetch(
      `https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const iceServers = await response.json();
    console.log("[ICE] 成功获取 Metered TURN 凭据");
    return iceServers;
  } catch (err) {
    console.warn("[ICE] 获取 Metered 凭据失败，使用默认服务器:", err);
    return DEFAULT_ICE_SERVERS;
  }
}

/**
 * 创建 PeerJS 配置
 */
function createPeerConfig(iceServers: RTCIceServer[]) {
  return {
    debug: 2, // 增加调试级别便于排查
    config: {
      iceServers,
      iceCandidatePoolSize: 10,
    },
  };
}

export interface PeerState {
  peerId: string | null;
  isConnected: boolean;
  isHost: boolean;
  connections: Map<string, DataConnection>;
  error: string | null;
}

type MessageHandler = (message: P2PMessage, senderId: string) => void;

/**
 * PeerJS connection management composable
 */
export function usePeer() {
  const peer = ref<Peer | null>(null);
  const peerId = ref<string | null>(null);
  const isConnected = ref(false);
  const isHost = ref(false);
  const connections = ref<Map<string, DataConnection>>(new Map());
  const error = ref<string | null>(null);
  const messageHandlers = ref<Map<MessageType, MessageHandler[]>>(new Map());

  /**
   * Initialize peer connection
   */
  async function initPeer(customId?: string): Promise<string> {
    // 先获取 ICE 服务器配置
    const iceServers = await fetchMeteredIceServers();
    const peerConfig = createPeerConfig(iceServers);

    return new Promise((resolve, reject) => {
      try {
        // Create peer with optional custom ID and ICE config
        peer.value = customId
          ? new Peer(customId, peerConfig)
          : new Peer(peerConfig);

        peer.value.on("open", (id) => {
          peerId.value = id;
          isConnected.value = true;
          error.value = null;
          console.log("[Peer] Connected with ID:", id);
          resolve(id);
        });

        peer.value.on("error", (err) => {
          console.error("[Peer] Error:", err);
          error.value = err.message;

          if (err.type === "unavailable-id") {
            reject(new Error("该房间ID已被使用"));
          } else if (err.type === "peer-unavailable") {
            reject(new Error("无法连接到房间"));
          } else {
            reject(err);
          }
        });

        peer.value.on("connection", (conn) => {
          handleIncomingConnection(conn);
        });

        peer.value.on("disconnected", () => {
          console.log("[Peer] Disconnected from server");
          isConnected.value = false;
        });

        peer.value.on("close", () => {
          console.log("[Peer] Connection closed");
          isConnected.value = false;
          connections.value.clear();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Create a room (become host)
   */
  async function createRoom(roomId: string): Promise<string> {
    const id = await initPeer(`room-${roomId}`);
    isHost.value = true;
    return id;
  }

  /**
   * Join an existing room
   */
  async function joinRoom(roomId: string): Promise<DataConnection> {
    await initPeer();

    return new Promise((resolve, reject) => {
      if (!peer.value) {
        reject(new Error("Peer not initialized"));
        return;
      }

      const conn = peer.value.connect(`room-${roomId}`, {
        reliable: true,
        serialization: "json",
      });

      conn.on("open", () => {
        console.log("[Peer] Connected to room:", roomId);
        connections.value.set(conn.peer, conn);
        setupConnectionHandlers(conn);
        resolve(conn);
      });

      conn.on("error", (err) => {
        console.error("[Peer] Connection error:", err);
        reject(err);
      });

      // ICE connection state change logging
      conn.peerConnection?.addEventListener("iceconnectionstatechange", () => {
        console.log(
          "[Peer] ICE state:",
          conn.peerConnection?.iceConnectionState
        );

        // 当连接成功时，记录使用的候选者信息
        if (
          conn.peerConnection?.iceConnectionState === "connected" ||
          conn.peerConnection?.iceConnectionState === "completed"
        ) {
          conn.peerConnection?.getStats().then((stats) => {
            stats.forEach((report) => {
              if (
                report.type === "candidate-pair" &&
                report.state === "succeeded"
              ) {
                console.log("[Peer] 成功的候选对:", report);
              }
              if (report.type === "local-candidate") {
                console.log(
                  "[Peer] 本地候选:",
                  report.candidateType,
                  report.address,
                  report.protocol
                );
              }
              if (report.type === "remote-candidate") {
                console.log(
                  "[Peer] 远程候选:",
                  report.candidateType,
                  report.address,
                  report.protocol
                );
              }
            });
          });
        }
      });

      conn.peerConnection?.addEventListener("icegatheringstatechange", () => {
        console.log(
          "[Peer] ICE gathering:",
          conn.peerConnection?.iceGatheringState
        );
      });

      // 记录发现的 ICE 候选者
      conn.peerConnection?.addEventListener("icecandidate", (event) => {
        if (event.candidate) {
          console.log(
            "[Peer] ICE candidate:",
            event.candidate.type,
            event.candidate.address,
            event.candidate.protocol
          );
        }
      });

      // Timeout for connection (increased for slower networks)
      setTimeout(() => {
        if (!conn.open) {
          console.error(
            "[Peer] Connection timeout. ICE state:",
            conn.peerConnection?.iceConnectionState
          );
          reject(new Error("连接超时，请检查网络或稍后重试"));
        }
      }, 15000);
    });
  }

  /**
   * Handle incoming connection (host only)
   */
  function handleIncomingConnection(conn: DataConnection): void {
    console.log("[Peer] Incoming connection from:", conn.peer);

    conn.on("open", () => {
      connections.value.set(conn.peer, conn);
      setupConnectionHandlers(conn);
    });

    conn.on("close", () => {
      connections.value.delete(conn.peer);
      // Notify about player leaving
      triggerHandler(
        "player-leave",
        {
          type: "player-leave",
          payload: { playerId: conn.peer },
          timestamp: Date.now(),
          senderId: conn.peer,
        },
        conn.peer
      );
    });

    conn.on("error", (err) => {
      console.error("[Peer] Connection error:", err);
      connections.value.delete(conn.peer);
    });
  }

  /**
   * Setup message handlers for a connection
   */
  function setupConnectionHandlers(conn: DataConnection): void {
    conn.on("data", (data) => {
      const message = data as P2PMessage;
      console.log("[Peer] Received message:", message.type, "from:", conn.peer);
      triggerHandler(message.type, message, conn.peer);
    });

    conn.on("close", () => {
      console.log("[Peer] Connection closed:", conn.peer);
      connections.value.delete(conn.peer);
    });
  }

  /**
   * Send message to a specific peer
   */
  function sendTo(
    peerId: string,
    message: Omit<P2PMessage, "timestamp" | "senderId">
  ): void {
    const conn = connections.value.get(peerId);
    if (conn && conn.open) {
      const fullMessage: P2PMessage = {
        ...message,
        timestamp: Date.now(),
        senderId: peer.value?.id || "",
      };
      conn.send(fullMessage);
    }
  }

  /**
   * Send message to host (for non-host players)
   */
  function sendToHost(
    message: Omit<P2PMessage, "timestamp" | "senderId">
  ): void {
    const hostConn = Array.from(connections.value.values())[0];
    if (hostConn && hostConn.open) {
      const fullMessage: P2PMessage = {
        ...message,
        timestamp: Date.now(),
        senderId: peer.value?.id || "",
      };
      hostConn.send(fullMessage);
    }
  }

  /**
   * Broadcast message to all connected peers
   */
  function broadcast(
    message: Omit<P2PMessage, "timestamp" | "senderId">
  ): void {
    const fullMessage: P2PMessage = {
      ...message,
      timestamp: Date.now(),
      senderId: peer.value?.id || "",
    };

    for (const conn of connections.value.values()) {
      if (conn.open) {
        conn.send(fullMessage);
      }
    }
  }

  /**
   * Register a message handler
   */
  function onMessage(type: MessageType, handler: MessageHandler): void {
    const handlers = messageHandlers.value.get(type) || [];
    handlers.push(handler);
    messageHandlers.value.set(type, handlers);
  }

  /**
   * Remove a message handler
   */
  function offMessage(type: MessageType, handler: MessageHandler): void {
    const handlers = messageHandlers.value.get(type) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
      messageHandlers.value.set(type, handlers);
    }
  }

  /**
   * Trigger handlers for a message type
   */
  function triggerHandler(
    type: MessageType,
    message: P2PMessage,
    senderId: string
  ): void {
    const handlers = messageHandlers.value.get(type) || [];
    for (const handler of handlers) {
      handler(message, senderId);
    }
  }

  /**
   * Get connected peer IDs
   */
  const connectedPeers = computed(() => Array.from(connections.value.keys()));

  /**
   * Disconnect and cleanup
   */
  function disconnect(): void {
    for (const conn of connections.value.values()) {
      conn.close();
    }
    connections.value.clear();

    if (peer.value) {
      peer.value.destroy();
      peer.value = null;
    }

    peerId.value = null;
    isConnected.value = false;
    isHost.value = false;
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect();
  });

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
    disconnect,
  };
}
