import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  GameState,
  RoomState,
  Player,
  ChatMessage,
  PlayerAction,
} from "@/core/types";

// Game phase names
export type GamePhase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "ended";

// System record types
export type SystemRecordType =
  | "hand-start" // 新一局开始
  | "blinds-posted" // 盲注下注
  | "phase-flop" // 翻牌
  | "phase-turn" // 转牌
  | "phase-river" // 河牌
  | "showdown" // 摊牌
  | "winner" // 赢家公布
  | "hand-end" // 一局结束
  | "tip"; // 打赏

// Action history record type
export interface ActionRecord {
  id: string;
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  action: PlayerAction;
  amount?: number;
  timestamp: number;
  phase: GamePhase;
  potAfter: number;
  playerChipsAfter: number;
  // System record fields
  isSystem?: boolean;
  systemType?: SystemRecordType;
  systemMessage?: string;
  communityCards?: string[]; // 用于显示公共牌
  // Tip record fields
  tipToPlayerId?: string;
  tipToPlayerName?: string;
  tipToPlayerAvatar?: string;
}

export const useGameStore = defineStore("game", () => {
  // Room state
  const roomState = ref<RoomState | null>(null);

  // Game state
  const gameState = ref<GameState | null>(null);

  // Chat messages
  const chatMessages = ref<ChatMessage[]>([]);

  // Action history
  const actionHistory = ref<ActionRecord[]>([]);

  // Error state
  const error = ref<string | null>(null);

  // Loading state
  const isLoading = ref(false);

  // Computed
  const players = computed(() => gameState.value?.players || []);
  const phase = computed(() => gameState.value?.phase || "waiting");
  const communityCards = computed(() => gameState.value?.communityCards || []);
  const totalPot = computed(
    () => gameState.value?.pots.reduce((sum, pot) => sum + pot.amount, 0) || 0
  );
  const currentPlayer = computed(
    () => gameState.value?.players.find((p) => p.isTurn) || null
  );
  const winners = computed(() => gameState.value?.winners || []);
  const isGameStarted = computed(() => roomState.value?.isGameStarted || false);
  const settings = computed(() => roomState.value?.settings);

  /**
   * Update game state
   */
  function updateGameState(state: GameState): void {
    gameState.value = state;
    if (roomState.value) {
      roomState.value.gameState = state;
    }
  }

  /**
   * Update room state
   */
  function updateRoomState(state: RoomState): void {
    roomState.value = state;
    if (state.gameState) {
      gameState.value = state.gameState;
    }
  }

  /**
   * Add chat message
   */
  function addChatMessage(message: ChatMessage): void {
    chatMessages.value.push(message);
    // Keep last 100 messages
    if (chatMessages.value.length > 100) {
      chatMessages.value = chatMessages.value.slice(-100);
    }
  }

  /**
   * Clear chat messages
   */
  function clearChat(): void {
    chatMessages.value = [];
  }

  /**
   * Add action record to history
   */
  function addActionRecord(
    playerId: string,
    playerName: string,
    playerAvatar: string | undefined,
    action: PlayerAction,
    amount: number | undefined,
    phase: GamePhase,
    potAfter: number,
    playerChipsAfter: number
  ): void {
    actionHistory.value.push({
      id: `${playerId}-${Date.now()}`,
      playerId,
      playerName,
      playerAvatar,
      action,
      amount,
      timestamp: Date.now(),
      phase,
      potAfter,
      playerChipsAfter,
    });
    // Keep last 100 records
    if (actionHistory.value.length > 100) {
      actionHistory.value = actionHistory.value.slice(-100);
    }
  }

  /**
   * Add system record to history
   */
  function addSystemRecord(
    systemType: SystemRecordType,
    message: string,
    phase?: GamePhase,
    communityCards?: string[],
    tipOptions?: {
      fromPlayerId?: string;
      fromPlayerName?: string;
      fromPlayerAvatar?: string;
      tipToPlayerId?: string;
      tipToPlayerName?: string;
      tipToPlayerAvatar?: string;
    }
  ): void {
    actionHistory.value.push({
      id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      playerId: tipOptions?.fromPlayerId || "system",
      playerName: tipOptions?.fromPlayerName || "系统",
      playerAvatar: tipOptions?.fromPlayerAvatar,
      action: "check" as PlayerAction, // placeholder, not used for system
      timestamp: Date.now(),
      phase: phase || "waiting",
      potAfter: 0,
      playerChipsAfter: 0,
      isSystem: true,
      systemType,
      systemMessage: message,
      communityCards,
      tipToPlayerId: tipOptions?.tipToPlayerId,
      tipToPlayerName: tipOptions?.tipToPlayerName,
      tipToPlayerAvatar: tipOptions?.tipToPlayerAvatar,
    });
    // Keep last 100 records
    if (actionHistory.value.length > 100) {
      actionHistory.value = actionHistory.value.slice(-100);
    }
  }

  /**
   * Clear action history (e.g., when starting new game)
   */
  function clearActionHistory(): void {
    actionHistory.value = [];
  }

  /**
   * Set error
   */
  function setError(errorMessage: string | null): void {
    error.value = errorMessage;
  }

  /**
   * Set loading state
   */
  function setLoading(loading: boolean): void {
    isLoading.value = loading;
  }

  /**
   * Get player by ID
   */
  function getPlayer(playerId: string): Player | null {
    return gameState.value?.players.find((p) => p.id === playerId) || null;
  }

  /**
   * Reset all state
   */
  function reset(): void {
    roomState.value = null;
    gameState.value = null;
    chatMessages.value = [];
    actionHistory.value = [];
    error.value = null;
    isLoading.value = false;
  }

  return {
    // State
    roomState,
    gameState,
    chatMessages,
    actionHistory,
    error,
    isLoading,

    // Computed
    players,
    phase,
    communityCards,
    totalPot,
    currentPlayer,
    winners,
    isGameStarted,
    settings,

    // Actions
    updateGameState,
    updateRoomState,
    addChatMessage,
    clearChat,
    addActionRecord,
    addSystemRecord,
    clearActionHistory,
    setError,
    setLoading,
    getPlayer,
    reset,
  };
});
