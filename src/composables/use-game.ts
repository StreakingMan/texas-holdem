import { ref, computed, watch } from "vue";
import { GameEngine, DEFAULT_SETTINGS, createPlayer } from "@/core/game-engine";
import type {
  GameState,
  PlayerAction,
  RoomState,
  GameSettings,
  P2PMessage,
  PlayerJoinPayload,
  PlayerActionPayload,
} from "@/core/types";

export interface UseGameOptions {
  isHost: boolean;
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  onStateChange?: (state: GameState) => void;
}

/**
 * Game state management composable
 */
export function useGame(options: UseGameOptions) {
  const { isHost, playerId, playerName, playerAvatar } = options;

  // Game engine (only used by host)
  const engine = ref<GameEngine | null>(null);

  // Game state (synced across all players)
  const gameState = ref<GameState | null>(null);
  const roomState = ref<RoomState | null>(null);

  // Map senderId (peer connection ID) to playerId (for player-leave handling)
  const senderToPlayerMap = new Map<string, string>();

  // Local player state
  const localPlayer = computed(
    () => gameState.value?.players.find((p) => p.id === playerId) || null
  );

  // Current player (whose turn it is)
  const currentPlayer = computed(
    () => gameState.value?.players.find((p) => p.isTurn) || null
  );

  // Is it local player's turn
  const isMyTurn = computed(() => localPlayer.value?.isTurn || false);

  // Available actions for local player
  const availableActions = computed((): PlayerAction[] => {
    if (!isMyTurn.value) return [];

    // Host uses engine directly
    if (isHost && engine.value) {
      return engine.value.getValidActions(playerId);
    }

    // Non-host calculates from gameState
    if (!gameState.value || !localPlayer.value) return [];

    const actions: PlayerAction[] = ["fold"];
    const player = localPlayer.value;
    const currentBet = gameState.value.currentBet;

    // Can check if player's bet matches current bet
    if (player.bet >= currentBet) {
      actions.push("check");
    }

    // Can call if there's a bet to match
    if (player.bet < currentBet && player.chips > 0) {
      actions.push("call");
    }

    // Can raise if player has enough chips
    const minRaiseAmount = currentBet + gameState.value.minRaise - player.bet;
    if (player.chips >= minRaiseAmount) {
      actions.push("raise");
    }

    // Can always go all-in if has chips
    if (player.chips > 0) {
      actions.push("all-in");
    }

    return actions;
  });

  // Call amount for local player
  const callAmount = computed(() => {
    if (isHost && engine.value) {
      return engine.value.getCallAmount(playerId);
    }
    // Non-host calculates from gameState
    if (!gameState.value || !localPlayer.value) return 0;
    return Math.min(
      gameState.value.currentBet - localPlayer.value.bet,
      localPlayer.value.chips
    );
  });

  // Min raise amount
  const minRaise = computed(() => {
    if (isHost && engine.value) {
      return engine.value.getMinRaise();
    }
    // Non-host gets from gameState
    return gameState.value?.minRaise || 0;
  });

  // Max raise amount
  const maxRaise = computed(() => {
    if (isHost && engine.value) {
      return engine.value.getMaxRaise(playerId);
    }
    // Non-host calculates from gameState
    if (!gameState.value || !localPlayer.value) return 0;
    return (
      localPlayer.value.chips +
      localPlayer.value.bet -
      gameState.value.currentBet
    );
  });

  /**
   * Initialize game (host only)
   */
  function initGame(settings: GameSettings = DEFAULT_SETTINGS): void {
    if (!isHost) return;

    engine.value = new GameEngine(settings);

    // Add host as first player
    const hostPlayer = createPlayer(
      playerId,
      playerName,
      0,
      settings.startingChips,
      playerAvatar
    );
    engine.value.addPlayer(hostPlayer);

    gameState.value = engine.value.getState();

    roomState.value = {
      roomId: "",
      hostId: playerId,
      players: gameState.value.players,
      gameState: gameState.value,
      settings,
      isGameStarted: false,
    };
  }

  /**
   * Add a player to the game (host only)
   */
  function addPlayer(id: string, name: string, avatar?: string): boolean {
    if (!isHost || !engine.value || !roomState.value) return false;

    const seatIndex = findAvailableSeat();
    if (seatIndex === -1) return false;

    const player = createPlayer(
      id,
      name,
      seatIndex,
      roomState.value.settings.startingChips,
      avatar
    );

    const success = engine.value.addPlayer(player);
    if (success) {
      gameState.value = engine.value.getState();
      roomState.value.players = gameState.value.players;
    }

    return success;
  }

  /**
   * Remove a player from the game (host only)
   */
  function removePlayer(id: string): boolean {
    if (!isHost || !engine.value) return false;

    const success = engine.value.removePlayer(id);
    if (success) {
      gameState.value = engine.value.getState();
      if (roomState.value) {
        roomState.value.players = gameState.value.players;
      }
    }

    return success;
  }

  /**
   * Find an available seat
   */
  function findAvailableSeat(): number {
    if (!roomState.value) return -1;

    const takenSeats = new Set(roomState.value.players.map((p) => p.seatIndex));
    for (let i = 0; i < roomState.value.settings.maxPlayers; i++) {
      if (!takenSeats.has(i)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Start the game (host only)
   */
  function startGame(): boolean {
    if (!isHost || !engine.value || !roomState.value) return false;

    const success = engine.value.startHand();
    if (success) {
      gameState.value = engine.value.getState();
      roomState.value.isGameStarted = true;
      roomState.value.gameState = gameState.value;
    }

    return success;
  }

  /**
   * Process a player action (host only)
   */
  function processAction(
    actionPlayerId: string,
    action: PlayerAction,
    amount?: number
  ): boolean {
    if (!isHost || !engine.value) return false;

    const success = engine.value.processAction(actionPlayerId, action, amount);
    if (success) {
      gameState.value = engine.value.getState();
      if (roomState.value) {
        roomState.value.gameState = gameState.value;
      }
    }

    return success;
  }

  /**
   * Start next hand (host only)
   */
  function nextHand(): boolean {
    if (!isHost || !engine.value) return false;

    engine.value.resetForNextHand();
    return startGame();
  }

  /**
   * Update game state (for non-host players)
   */
  function updateState(state: GameState): void {
    gameState.value = state;
  }

  /**
   * Update room state (for non-host players)
   */
  function updateRoomState(state: RoomState): void {
    roomState.value = state;
    gameState.value = state.gameState;
  }

  /**
   * Handle incoming P2P messages
   */
  function handleMessage(message: P2PMessage, senderId: string): void {
    switch (message.type) {
      case "player-join":
        if (isHost) {
          const payload = message.payload as PlayerJoinPayload;
          // Use player's own ID from payload, not senderId
          // Store mapping for player-leave handling
          senderToPlayerMap.set(senderId, payload.player.id);
          addPlayer(
            payload.player.id,
            payload.player.name,
            payload.player.avatar
          );
        }
        break;

      case "player-leave":
        if (isHost) {
          // Look up actual playerId from senderId mapping
          const actualPlayerId = senderToPlayerMap.get(senderId) || senderId;
          senderToPlayerMap.delete(senderId);
          removePlayer(actualPlayerId);
        }
        break;

      case "player-action":
        if (isHost) {
          const payload = message.payload as PlayerActionPayload;
          processAction(payload.playerId, payload.action, payload.amount);
        }
        break;

      case "game-state":
        if (!isHost) {
          updateState(message.payload as GameState);
        }
        break;

      case "room-state":
        if (!isHost) {
          updateRoomState(message.payload as RoomState);
        }
        break;

      case "start-game":
        // Game started notification (handled by game-state update)
        break;

      case "tip-player":
        // Tip is handled in GameView.vue for broadcast coordination
        break;
    }
  }

  /**
   * Process a tip from one player to another (host only)
   */
  function tipPlayer(fromId: string, toId: string, amount: number): boolean {
    if (!isHost || !engine.value) {
      return false;
    }

    const success = engine.value.tipPlayer(fromId, toId, amount);
    if (success) {
      // Get updated state
      const newState = engine.value.getState();
      updateState(newState);
    }
    return success;
  }

  /**
   * Get current game phase in Chinese
   */
  const phaseText = computed(() => {
    const phases: Record<string, string> = {
      waiting: "等待中",
      preflop: "翻牌前",
      flop: "翻牌",
      turn: "转牌",
      river: "河牌",
      showdown: "摊牌",
      ended: "结束",
    };
    return phases[gameState.value?.phase || "waiting"] || "未知";
  });

  /**
   * Get total pot amount
   */
  const totalPot = computed(
    () => gameState.value?.pots.reduce((sum, pot) => sum + pot.amount, 0) || 0
  );

  /**
   * Check if game can start
   */
  const canStartGame = computed(() => {
    if (!roomState.value) return false;
    return (
      roomState.value.players.length >= 2 && !roomState.value.isGameStarted
    );
  });

  /**
   * Get the reason why a new hand cannot be started (for next hand button)
   */
  const startHandError = computed(() => {
    if (isHost && engine.value) {
      return engine.value.getStartHandError();
    }
    // Non-host: calculate from gameState
    if (!gameState.value) return null;
    const connectedPlayers = gameState.value.players.filter(
      (p) => p.isConnected
    );
    const playersWithChips = connectedPlayers.filter((p) => p.chips > 0);

    if (connectedPlayers.length < 2) {
      return "等待更多玩家加入";
    }
    if (playersWithChips.length < 2) {
      const winner = playersWithChips[0];
      if (winner) {
        return `🏆 ${winner.name} 赢得了所有筹码！游戏结束`;
      }
      return "所有玩家筹码耗尽";
    }
    return null;
  });

  // Watch for state changes and notify
  watch(
    gameState,
    (newState) => {
      if (newState && options.onStateChange) {
        options.onStateChange(newState);
      }
    },
    { deep: true }
  );

  return {
    // State
    gameState,
    roomState,
    localPlayer,
    currentPlayer,
    isMyTurn,
    availableActions,
    callAmount,
    minRaise,
    maxRaise,
    phaseText,
    totalPot,
    canStartGame,
    startHandError,

    // Methods
    initGame,
    addPlayer,
    removePlayer,
    startGame,
    processAction,
    nextHand,
    updateState,
    updateRoomState,
    handleMessage,
    findAvailableSeat,
    tipPlayer,
  };
}
