<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePlayerStore } from "@/stores/player-store";
import { useGameStore } from "@/stores/game-store";
import { usePeer } from "@/composables/use-peer";
import { useGame } from "@/composables/use-game";
import { useChat } from "@/composables/use-chat";
import PokerTable from "@/components/game/PokerTable.vue";
import ActionPanel from "@/components/game/ActionPanel.vue";
import ActionHistory from "@/components/game/ActionHistory.vue";
import ChatBox from "@/components/chat/ChatBox.vue";
import LobbyPanel from "@/components/lobby/LobbyPanel.vue";
import HelpModal from "@/components/game/HelpModal.vue";
import type {
  GameState,
  RoomState,
  PlayerActionPayload,
  ChatMessage,
  Card,
  GamePhase,
  TipPayload,
  RequestExtensionPayload,
} from "@/core/types";
import {
  Copy,
  Check,
  LogOut,
  Play,
  Users,
  TrendingUp,
  Layers,
  Coins,
  Plus,
  Github,
  MessageCircle,
  History,
  X,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const gameStore = useGameStore();

const roomId = route.params.roomId as string;
const isHost = playerStore.isHost;
const copied = ref(false);
const connectionError = ref("");
const isConnecting = ref(true);

// Help modal state
const showHelpModal = ref(false);
const helpModalType = ref<"hand-rankings" | "win-rate">("hand-rankings");

// Add chips popover state
const showAddChipsPopover = ref(false);
const addChipsPresets = [500, 1000, 2000];

function toggleAddChipsPopover() {
  showAddChipsPopover.value = !showAddChipsPopover.value;
}

function addChipsToAll(amount: number) {
  if (!isHost || amount <= 0) return;

  game.addChipsToAll(amount);

  // Add system record
  gameStore.addSystemRecord(
    "chips-added",
    `💰 房主为全员增加 $${amount.toLocaleString()} 筹码`
  );

  // Broadcast updated states
  peer.broadcast({
    type: "game-state",
    payload: game.gameState.value,
  });
  peer.broadcast({
    type: "room-state",
    payload: game.roomState.value,
  });

  // Close popover
  showAddChipsPopover.value = false;
}

// Sidebar resize state
const historyPanelHeight = ref(40); // percentage
const isResizing = ref(false);
const sidebarRef = ref<HTMLElement | null>(null);

// Mobile drawer state
const showMobileDrawer = ref(false);
const mobileDrawerTab = ref<'chat' | 'history'>('chat');

function openMobileDrawer(tab: 'chat' | 'history') {
  mobileDrawerTab.value = tab;
  showMobileDrawer.value = true;
}

function closeMobileDrawer() {
  showMobileDrawer.value = false;
}

function startResize(e: MouseEvent) {
  isResizing.value = true;
  document.addEventListener("mousemove", onResize);
  document.addEventListener("mouseup", stopResize);
  e.preventDefault();
}

function onResize(e: MouseEvent) {
  if (!isResizing.value || !sidebarRef.value) return;

  const sidebar = sidebarRef.value;
  const rect = sidebar.getBoundingClientRect();
  const offsetY = e.clientY - rect.top;
  const percentage = (offsetY / rect.height) * 100;

  // Clamp between 20% and 80%
  historyPanelHeight.value = Math.max(20, Math.min(80, percentage));
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener("mousemove", onResize);
  document.removeEventListener("mouseup", stopResize);
}

function openHelpModal(type: "hand-rankings" | "win-rate") {
  helpModalType.value = type;
  showHelpModal.value = true;
}

// Player chat bubbles
interface BubbleMessage {
  content: string;
  timestamp: number;
}
const playerBubbles = ref(new Map<string, BubbleMessage>());

// Last action tracking for effects
import type { PlayerAction } from "@/core/types";
interface LastActionInfo {
  playerId: string;
  action: PlayerAction;
  amount?: number;
}
const lastActionInfo = ref<LastActionInfo | null>(null);

// Winner/loser celebration state
const showWinnerCelebration = ref(false);
const isLocalPlayerWinner = computed(() => {
  const winners = gameStore.winners;
  if (!winners || winners.length === 0) return false;
  return winners.some((w) => w.playerId === playerStore.playerId);
});

// Tip effect state
interface TipEffect {
  fromPlayerId: string;
  toPlayerId: string;
  amount: number;
  timestamp: number;
}
const activeTipEffects = ref<TipEffect[]>([]);

function addTipEffect(fromPlayerId: string, toPlayerId: string, amount: number) {
  const effect: TipEffect = {
    fromPlayerId,
    toPlayerId,
    amount,
    timestamp: Date.now(),
  };
  activeTipEffects.value.push(effect);
  // Remove effect after animation
  setTimeout(() => {
    activeTipEffects.value = activeTipEffects.value.filter(
      (e) => e.timestamp !== effect.timestamp
    );
  }, 2000);
}

// Initialize composables
const peer = usePeer();
const game = useGame({
  isHost,
  playerId: playerStore.playerId,
  playerName: playerStore.playerName,
  playerAvatar: playerStore.avatar,
  onStateChange: (state) => {
    gameStore.updateGameState(state);
    // Broadcast state to all players (host only)
    if (isHost) {
      peer.broadcast({
        type: "game-state",
        payload: state,
      });
    }
  },
});
const chat = useChat(
  playerStore.playerId,
  playerStore.playerName,
  playerStore.avatar
);

// Computed states
const showLobby = computed(() => !gameStore.isGameStarted);
const canStartGame = computed(
  () => isHost && game.canStartGame.value && gameStore.players.length >= 2
);

// Initialize connection
onMounted(async () => {
  try {
    if (isHost) {
      // Create room as host
      await peer.createRoom(roomId);
      game.initGame();

      if (game.roomState.value) {
        game.roomState.value.roomId = roomId;
        gameStore.updateRoomState(game.roomState.value);
      }
    } else {
      // Join existing room
      await peer.joinRoom(roomId);

      // Send join message to host
      peer.sendToHost({
        type: "player-join",
        payload: {
          player: {
            id: playerStore.playerId,
            name: playerStore.playerName,
            avatar: playerStore.avatar,
          },
        },
      });
    }

    isConnecting.value = false;
  } catch (e) {
    connectionError.value = (e as Error).message;
    isConnecting.value = false;
  }
});

// Map senderId to player name for leave handling
const senderPlayerNames = new Map<string, string>();

// Setup message handlers
onMounted(() => {
  // Handle player join (host only)
  peer.onMessage("player-join", (message, senderId) => {
    if (isHost) {
      const payload = message.payload as { player: { id: string; name: string } };
      
      // Store sender -> player name mapping for leave handling
      senderPlayerNames.set(senderId, payload.player.name);
      
      const isGameInProgress =
        game.gameState.value?.phase && game.gameState.value.phase !== "waiting";

      game.handleMessage(message, senderId);

      // Send current room state to new player
      if (game.roomState.value) {
        peer.sendTo(senderId, {
          type: "room-state",
          payload: game.roomState.value,
        });
      }

      // Broadcast updated state to all
      if (game.gameState.value) {
        peer.broadcast({
          type: "game-state",
          payload: game.gameState.value,
        });
      }
      if (isGameInProgress) {
        chat.addSystemMessage(
          `${payload.player.name} 中途加入房间，将在下一局参与游戏`
        );
      } else {
        chat.addSystemMessage(`${payload.player.name} 加入了房间`);
      }
    }
  });

  // Handle player leave
  peer.onMessage("player-leave", (message, senderId) => {
    if (isHost) {
      // Get player name from mapping (set during player-join)
      const playerName = senderPlayerNames.get(senderId) || '玩家';
      senderPlayerNames.delete(senderId);
      
      // Add local system message
      chat.addSystemMessage(`${playerName} 离开了房间`);
      
      game.handleMessage(message, senderId);

      // Broadcast player left notification to all players
      peer.broadcast({
        type: "player-left",
        payload: { playerName },
      });

      // Broadcast updated state
      if (game.gameState.value) {
        peer.broadcast({
          type: "game-state",
          payload: game.gameState.value,
        });
      }
    }
  });

  // Handle player left notification (non-host)
  peer.onMessage("player-left", (message) => {
    if (!isHost) {
      const { playerName } = message.payload as { playerName: string };
      chat.addSystemMessage(`${playerName} 离开了房间`);
    }
  });

  // Handle player action
  peer.onMessage("player-action", (message, senderId) => {
    if (isHost) {
      game.handleMessage(message, senderId);
    }
  });

  // Handle game state (non-host)
  peer.onMessage("game-state", (message) => {
    if (!isHost) {
      const state = message.payload as GameState;
      // Hide celebration when new hand starts
      if (state.phase === 'preflop') {
        showWinnerCelebration.value = false;
      }
      game.updateState(state);
      gameStore.updateGameState(state);
    }
  });

  // Handle room state (non-host)
  peer.onMessage("room-state", (message) => {
    if (!isHost) {
      const state = message.payload as RoomState;
      game.updateRoomState(state);
      gameStore.updateRoomState(state);
    }
  });

  // Handle chat messages
  peer.onMessage("chat-message", (message) => {
    const chatMsg = message.payload as ChatMessage;

    // Skip if this is our own message (already added locally when sent)
    if (chatMsg.playerId === playerStore.playerId) {
      return;
    }

    chat.handleChatMessage(message);
    gameStore.addChatMessage(chatMsg);

    // Update sender's bubble
    updatePlayerBubble(chatMsg.playerId, chatMsg.content);

    // Host broadcasts chat messages to all other players
    if (isHost) {
      peer.broadcast({
        type: "chat-message",
        payload: chatMsg,
      });
    }
  });

  // Handle start game
  peer.onMessage("start-game", () => {
    // Game will be updated via game-state message
  });

  // Handle extension request
  peer.onMessage("request-extension", (message, senderId) => {
    if (isHost) {
      const payload = message.payload as RequestExtensionPayload;
      const player = game.gameState.value?.players.find(p => p.id === payload.playerId);
      const success = game.requestExtension(payload.playerId);
      
      if (success && player) {
        // Add system record
        gameStore.addSystemRecord(
          "extension",
          `⏱️ ${player.name} 支付 $10 延长思考时间 30 秒`
        );
        
        // Broadcast updated state
        peer.broadcast({
          type: "game-state",
          payload: game.gameState.value,
        });
      }
    }
  });

  // Handle tip message
  peer.onMessage("tip-player", (message) => {
    const tipPayload = message.payload as TipPayload;

    if (isHost) {
      // Host processes the tip
      const success = game.tipPlayer(
        tipPayload.fromPlayerId,
        tipPayload.toPlayerId,
        tipPayload.amount
      );

      if (success) {
        // Add tip effect
        addTipEffect(tipPayload.fromPlayerId, tipPayload.toPlayerId, tipPayload.amount);
        
        // Add tip record to action history
        gameStore.addSystemRecord(
          "tip",
          `💰 ${tipPayload.fromPlayerName} 打赏 ${tipPayload.toPlayerName} $${tipPayload.amount}`,
          undefined,
          undefined,
          {
            fromPlayerId: tipPayload.fromPlayerId,
            fromPlayerName: tipPayload.fromPlayerName,
            fromPlayerAvatar: tipPayload.fromPlayerAvatar,
            tipToPlayerId: tipPayload.toPlayerId,
            tipToPlayerName: tipPayload.toPlayerName,
            tipToPlayerAvatar: tipPayload.toPlayerAvatar,
          }
        );

        // Broadcast updated state and tip record
        peer.broadcast({
          type: "game-state",
          payload: game.gameState.value,
        });
        peer.broadcast({
          type: "tip-player",
          payload: { ...tipPayload, processed: true },
        });
      }
    } else {
      // Non-host: add tip record when receiving processed tip
      if ((tipPayload as TipPayload & { processed?: boolean }).processed) {
        // Add tip effect
        addTipEffect(tipPayload.fromPlayerId, tipPayload.toPlayerId, tipPayload.amount);
        
        gameStore.addSystemRecord(
          "tip",
          `💰 ${tipPayload.fromPlayerName} 打赏 ${tipPayload.toPlayerName} $${tipPayload.amount}`,
          undefined,
          undefined,
          {
            fromPlayerId: tipPayload.fromPlayerId,
            fromPlayerName: tipPayload.fromPlayerName,
            fromPlayerAvatar: tipPayload.fromPlayerAvatar,
            tipToPlayerId: tipPayload.toPlayerId,
            tipToPlayerName: tipPayload.toPlayerName,
            tipToPlayerAvatar: tipPayload.toPlayerAvatar,
          }
        );
      }
    }
  });
});

// Cleanup on unmount
onUnmounted(() => {
  peer.disconnect();
  gameStore.reset();
  playerStore.clearRoom();
  
  // Clear timeout timer
  if (turnTimeoutTimer) {
    clearTimeout(turnTimeoutTimer);
    turnTimeoutTimer = null;
  }
});

// Copy room ID
function copyRoomId(): void {
  navigator.clipboard.writeText(roomId);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

// Start game (host only)
function startGame(): void {
  if (!canStartGame.value) return;

  const success = game.startGame();
  if (success) {
    // Broadcast room-state with isGameStarted: true
    peer.broadcast({
      type: "room-state",
      payload: game.roomState.value,
    });
    peer.broadcast({
      type: "start-game",
      payload: {},
    });
  }
}

// Next hand (host only)
function nextHand(): void {
  if (!isHost) return;

  // Immediately hide celebration animation
  showWinnerCelebration.value = false;

  const success = game.nextHand();
  if (success) {
    peer.broadcast({
      type: "game-state",
      payload: game.gameState.value,
    });
  }
}

// Handle player action
function handleAction(action: string, amount?: number): void {
  if (isHost) {
    // Process directly
    game.processAction(playerStore.playerId, action as any, amount);
  } else {
    // Send to host
    const payload: PlayerActionPayload = {
      playerId: playerStore.playerId,
      action: action as any,
      amount,
    };
    peer.sendToHost({
      type: "player-action",
      payload,
    });
  }
}

// Send tip to another player
function sendTip(toPlayerId: string, amount: number): void {
  const toPlayer = game.gameState.value?.players.find(
    (p) => p.id === toPlayerId
  );
  if (!toPlayer) return;

  const tipPayload: TipPayload = {
    fromPlayerId: playerStore.playerId,
    fromPlayerName: playerStore.playerName,
    fromPlayerAvatar: playerStore.avatar,
    toPlayerId,
    toPlayerName: toPlayer.name,
    toPlayerAvatar: toPlayer.avatar,
    amount,
  };

  if (isHost) {
    // Process tip directly
    const success = game.tipPlayer(
      tipPayload.fromPlayerId,
      tipPayload.toPlayerId,
      tipPayload.amount
    );

    if (success) {
      // Add tip effect for host locally
      addTipEffect(tipPayload.fromPlayerId, tipPayload.toPlayerId, tipPayload.amount);
      
      // Add tip record
      gameStore.addSystemRecord(
        "tip",
        `💰 ${tipPayload.fromPlayerName} 打赏 ${tipPayload.toPlayerName} $${tipPayload.amount}`,
        undefined,
        undefined,
        {
          fromPlayerId: tipPayload.fromPlayerId,
          fromPlayerName: tipPayload.fromPlayerName,
          fromPlayerAvatar: tipPayload.fromPlayerAvatar,
          tipToPlayerId: tipPayload.toPlayerId,
          tipToPlayerName: tipPayload.toPlayerName,
          tipToPlayerAvatar: tipPayload.toPlayerAvatar,
        }
      );

      // Broadcast updated state and tip notification
      peer.broadcast({
        type: "game-state",
        payload: game.gameState.value,
      });
      peer.broadcast({
        type: "tip-player",
        payload: { ...tipPayload, processed: true },
      });
    }
  } else {
    // Send to host for processing
    peer.sendToHost({
      type: "tip-player",
      payload: tipPayload,
    });
  }
}

// Request turn time extension
function requestExtension(): void {
  if (isHost) {
    // Process directly
    const success = game.requestExtension(playerStore.playerId);
    if (success) {
      // Add system record
      gameStore.addSystemRecord(
        "extension",
        `⏱️ ${playerStore.playerName} 支付 $10 延长思考时间 30 秒`
      );
      
      peer.broadcast({
        type: "game-state",
        payload: game.gameState.value,
      });
    }
  } else {
    // Send to host
    const payload: RequestExtensionPayload = {
      playerId: playerStore.playerId,
    };
    peer.sendToHost({
      type: "request-extension",
      payload,
    });
  }
}

// Turn timeout handling (host only)
let turnTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

function startTurnTimeoutTimer() {
  if (!isHost) return;
  
  // Clear existing timer
  if (turnTimeoutTimer) {
    clearTimeout(turnTimeoutTimer);
    turnTimeoutTimer = null;
  }
  
  const gameState = game.gameState.value;
  if (!gameState?.turnStartTime || !gameState?.turnTimeLimit) return;
  
  const currentPlayer = gameStore.currentPlayer;
  if (!currentPlayer) return;
  
  // Calculate remaining time
  const elapsed = Math.floor((Date.now() - gameState.turnStartTime) / 1000);
  const remaining = gameState.turnTimeLimit - elapsed;
  
  if (remaining <= 0) {
    // Already timed out, handle immediately
    handleTurnTimeout(currentPlayer.id);
  } else {
    // Set timer for remaining time
    turnTimeoutTimer = setTimeout(() => {
      const currentPlayerNow = gameStore.currentPlayer;
      if (currentPlayerNow && currentPlayerNow.isTurn) {
        handleTurnTimeout(currentPlayerNow.id);
      }
    }, remaining * 1000);
  }
}

function handleTurnTimeout(playerId: string): void {
  if (!isHost) return;
  
  const player = game.gameState.value?.players.find(p => p.id === playerId);
  const success = game.handleTurnTimeout(playerId);
  if (success && player) {
    // Add system record
    gameStore.addSystemRecord(
      "timeout",
      `⏰ ${player.name} 超时自动弃牌`
    );
    
    // Broadcast updated state
    peer.broadcast({
      type: "game-state",
      payload: game.gameState.value,
    });
  }
}

// Watch for turn changes to start/stop timeout timer (host only)
watch(
  () => gameStore.currentPlayer?.id,
  () => {
    if (isHost) {
      startTurnTimeoutTimer();
    }
  },
  { immediate: true }
);

// Watch for turnTimeLimit changes (extension used)
watch(
  () => game.gameState.value?.turnTimeLimit,
  () => {
    if (isHost) {
      startTurnTimeoutTimer();
    }
  }
);

// Send chat message
function sendChatMessage(content: string): void {
  const message = chat.createMessage(content);
  chat.addMessage(message);
  gameStore.addChatMessage(message);

  // Update local player's bubble
  updatePlayerBubble(message.playerId, message.content);

  if (isHost) {
    peer.broadcast({
      type: "chat-message",
      payload: message,
    });
  } else {
    peer.sendToHost({
      type: "chat-message",
      payload: message,
    });
  }
}

// Update player bubble and auto-clear after 3 seconds
function updatePlayerBubble(playerId: string, content: string): void {
  // Don't show bubbles for system messages
  if (playerId === "system") return;

  playerBubbles.value.set(playerId, {
    content,
    timestamp: Date.now(),
  });

  // Force reactivity by creating a new Map
  playerBubbles.value = new Map(playerBubbles.value);
}

// Leave room
function leaveRoom(): void {
  peer.disconnect();
  router.push("/");
}

// Watch for game end to show next hand button
const showNextHandButton = computed(
  () => isHost && gameStore.phase === "ended"
);

// Get the error message for why next hand cannot start
const nextHandError = computed(() => game.startHandError.value);

// Helper function to format a card for display
function formatCard(card: Card | null): string {
  if (!card) return "?";
  const suitSymbols: Record<string, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };
  return `${suitSymbols[card.suit] || "?"}${card.rank}`;
}

// Helper function to get hand rank name in Chinese
function getHandRankName(rank: string): string {
  const rankNames: Record<string, string> = {
    "royal-flush": "皇家同花顺",
    "straight-flush": "同花顺",
    "four-of-a-kind": "四条",
    "full-house": "葫芦",
    flush: "同花",
    straight: "顺子",
    "three-of-a-kind": "三条",
    "two-pair": "两对",
    "one-pair": "一对",
    "high-card": "高牌",
  };
  return rankNames[rank] || rank;
}

// Track previous phase for system records
let lastPhase: GamePhase | null = null;
let lastRecordedAction: string | null = null;
let lastWinnerKey: string | null = null;
let handStartRecorded = false;

// Watch for host disconnect (non-host players)
const hostDisconnected = ref(false);
watch(
  () => peer.connectedPeers.value,
  (connectedPeers, oldPeers) => {
    // For non-host players, if connection to host is lost
    if (!isHost && oldPeers && oldPeers.length > 0 && connectedPeers.length === 0) {
      hostDisconnected.value = true;
      // Auto redirect after 3 seconds
      setTimeout(() => {
        router.push('/');
      }, 3000);
    }
  }
);

// Watch for phase changes to add system records
watch(
  () => gameStore.phase,
  (newPhase, oldPhase) => {
    if (!newPhase || newPhase === oldPhase || newPhase === lastPhase) return;
    lastPhase = newPhase;

    const communityCards = gameStore.communityCards.map((c) => formatCard(c));

    // Record phase changes
    switch (newPhase) {
      case "preflop":
        // New hand started - record hand start and blinds
        if (!handStartRecorded) {
          gameStore.addSystemRecord(
            "hand-start",
            "🎴 新一局开始，发牌中...",
            newPhase
          );

          // Find small and big blind players
          const sbPlayer = gameStore.players.find((p) => p.isSmallBlind);
          const bbPlayer = gameStore.players.find((p) => p.isBigBlind);
          if (sbPlayer && bbPlayer) {
            const sbAmount = gameStore.settings?.smallBlind || 10;
            const bbAmount = gameStore.settings?.bigBlind || 20;
            gameStore.addSystemRecord(
              "blinds-posted",
              `💰 ${sbPlayer.name} 下小盲 $${sbAmount}，${bbPlayer.name} 下大盲 $${bbAmount}`,
              newPhase
            );
          }
          handStartRecorded = true;
        }
        break;

      case "flop":
        gameStore.addSystemRecord(
          "phase-flop",
          "🃏 翻牌 - 发出前3张公共牌",
          newPhase,
          communityCards.slice(0, 3)
        );
        break;

      case "turn":
        gameStore.addSystemRecord(
          "phase-turn",
          "🃏 转牌 - 发出第4张公共牌",
          newPhase,
          communityCards.slice(3, 4)
        );
        break;

      case "river":
        gameStore.addSystemRecord(
          "phase-river",
          "🃏 河牌 - 发出第5张公共牌",
          newPhase,
          communityCards.slice(4, 5)
        );
        break;

      case "showdown":
        gameStore.addSystemRecord(
          "showdown",
          "🎭 摊牌 - 所有玩家亮出底牌",
          newPhase,
          communityCards
        );
        break;

      case "ended":
        // Winner announcement is handled by winners watcher
        handStartRecorded = false; // Reset for next hand
        break;
    }
  },
  { immediate: true }
);

// Watch for winners to add system records and show celebration
watch(
  () => gameStore.winners,
  (winners) => {
    if (!winners || winners.length === 0) return;

    // Create a unique key to prevent duplicate records
    const winnerKey = winners.map((w) => `${w.playerId}-${w.amount}`).join("|");
    if (winnerKey === lastWinnerKey) return;
    lastWinnerKey = winnerKey;

    // IMPORTANT: 在记录 winners 之前，先检查并记录未处理的 lastAction
    // 这解决了 Guest 端收到最终状态时 winners watch 先于 lastAction watch 执行的问题
    const state = gameStore.gameState;
    if (state?.lastAction) {
      const actionPhase = state.lastAction.phase;
      const actionKey = `${state.lastAction.playerId}-${
        state.lastAction.action
      }-${state.lastAction.amount || 0}-${actionPhase}`;

      if (actionKey !== lastRecordedAction) {
        lastRecordedAction = actionKey;
        const player = gameStore.getPlayer(state.lastAction.playerId);
        if (player) {
          gameStore.addActionRecord(
            state.lastAction.playerId,
            player.name,
            player.avatar,
            state.lastAction.action,
            state.lastAction.amount,
            actionPhase,
            gameStore.totalPot,
            player.chips
          );

          lastActionInfo.value = {
            playerId: state.lastAction.playerId,
            action: state.lastAction.action,
            amount: state.lastAction.amount,
          };
        }
      }
    }

    // Show winner celebration
    showWinnerCelebration.value = true;
    setTimeout(() => {
      showWinnerCelebration.value = false;
    }, 4000);

    // Record each winner
    winners.forEach((winner) => {
      const player = gameStore.getPlayer(winner.playerId);
      if (player) {
        const handDesc =
          winner.hand?.description ||
          getHandRankName(winner.hand?.rank || "high-card");
        gameStore.addSystemRecord(
          "winner",
          `🏆 ${player.name} 赢得 $${winner.amount.toLocaleString()}${
            handDesc ? ` (${handDesc})` : ""
          }`
        );
      }
    });

    // Add hand end record
    gameStore.addSystemRecord("hand-end", "📋 本局结束，等待下一局...");
  },
  { deep: true }
);

// Watch for lastAction changes to record in action history
watch(
  () => gameStore.gameState,
  (state) => {
    if (state?.lastAction) {
      // 使用 lastAction 中记录的 phase，而不是当前 state.phase（可能已被 advancePhase 改变）
      const actionPhase = state.lastAction.phase;
      // Create unique key for this action to avoid duplicates
      const actionKey = `${state.lastAction.playerId}-${
        state.lastAction.action
      }-${state.lastAction.amount || 0}-${actionPhase}`;

      // Only record if this is a new action
      if (actionKey !== lastRecordedAction) {
        lastRecordedAction = actionKey;
        const player = gameStore.getPlayer(state.lastAction.playerId);
        if (player) {
          gameStore.addActionRecord(
            state.lastAction.playerId,
            player.name,
            player.avatar,
            state.lastAction.action,
            state.lastAction.amount,
            actionPhase,
            gameStore.totalPot,
            player.chips
          );

          // Update lastActionInfo for visual effects
          lastActionInfo.value = {
            playerId: state.lastAction.playerId,
            action: state.lastAction.action,
            amount: state.lastAction.amount,
          };
        }
      }
    }
  },
  { deep: true }
);
</script>

<template>
  <div
    class="w-screen flex flex-col overflow-hidden bg-linear-to-br from-gray-900 via-emerald-950 to-gray-900"
    style="height: var(--app-height, 100vh);"
  >
    <!-- Top bar -->
    <header
      class="shrink-0 h-12 sm:h-14 bg-gray-900/80 backdrop-blur border-b border-gray-700/50 flex items-center justify-between px-2 sm:px-4 overflow-visible z-20"
    >
      <div class="flex items-center gap-1.5 sm:gap-3 overflow-visible">
        <!-- Logo - hidden on mobile -->
        <h1
          class="text-xl font-semibold text-amber-400 hidden md:flex items-center tracking-wide"
          style="font-family: var(--font-display)"
        >
          德州扑克教学
        </h1>

        <!-- Room info card -->
        <div
          class="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-800/80 rounded-lg"
        >
          <!-- Room ID -->
          <div class="flex items-center gap-1 sm:gap-1.5">
            <span class="text-gray-500 text-[10px] sm:text-xs hidden sm:inline">房间</span>
            <span class="text-amber-400 font-mono font-bold text-xs sm:text-sm">{{
              roomId
            }}</span>
            <button
              @click="copyRoomId"
              class="p-0.5 hover:bg-gray-700 rounded transition-colors"
              :title="copied ? '已复制' : '复制'"
            >
              <Check v-if="copied" class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <Copy v-else class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
            </button>
          </div>

          <div class="w-px h-3 sm:h-4 bg-gray-700 hidden sm:block"></div>

          <!-- Players count -->
          <div class="flex items-center gap-1 text-gray-400 text-xs sm:text-sm">
            <Users class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{{ gameStore.players.length }}/9</span>
          </div>

          <!-- Starting chips - hidden on small mobile -->
          <div class="hidden sm:flex items-center">
            <div class="w-px h-4 bg-gray-700 mr-2 sm:mr-3"></div>
            <div class="flex items-center gap-1.5 relative">
              <Coins class="w-3.5 h-3.5 text-emerald-400" />
              <span class="text-emerald-400 text-sm font-medium"
                >${{
                  (gameStore.settings?.startingChips ?? 1000).toLocaleString()
                }}</span
              >

              <!-- Add chips button (host only) -->
              <button
                v-if="isHost"
                @click="toggleAddChipsPopover"
                class="p-0.5 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors ml-0.5"
                title="增发筹码"
              >
                <Plus class="w-3.5 h-3.5" />
              </button>

              <!-- Add chips popover -->
              <Transition name="fade">
                <div
                  v-if="showAddChipsPopover"
                  class="absolute top-full left-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg p-2.5 shadow-xl z-50 min-w-[120px]"
                  @click.stop
                >
                  <p class="text-gray-500 text-xs mb-2">全员增发</p>
                  <div class="flex flex-col gap-1">
                    <button
                      v-for="amount in addChipsPresets"
                      :key="amount"
                      @click="addChipsToAll(amount)"
                      class="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm rounded transition-colors text-left"
                    >
                      +${{ amount.toLocaleString() }}
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- Help buttons -->
        <div class="flex items-center gap-1 sm:gap-2">
          <button
            @click="openHelpModal('win-rate')"
            class="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/30"
            title="起手胜率"
          >
            <TrendingUp class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span class="text-[10px] sm:text-xs font-medium">胜率</span>
          </button>
          <button
            @click="openHelpModal('hand-rankings')"
            class="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 rounded-lg transition-colors border border-purple-500/30"
            title="牌型大小"
          >
            <Layers class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span class="text-[10px] sm:text-xs font-medium">牌型</span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-1.5 sm:gap-3">
        <button
          v-if="canStartGame"
          @click="startGame"
          class="px-2 sm:px-4 py-1.5 sm:py-2 bg-linear-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs sm:text-sm font-medium rounded-lg shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-1 sm:gap-2"
        >
          <Play class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span class="hidden xs:inline">开始游戏</span>
          <span class="xs:hidden">开始</span>
        </button>
        <!-- Next hand button with error state -->
        <div v-if="showNextHandButton" class="relative group">
          <button
            @click="nextHand"
            :disabled="!!nextHandError"
            class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/30 disabled:text-gray-500 disabled:border-gray-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
            title="下一局"
          >
            <Play class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span class="text-[10px] sm:text-xs font-medium hidden xs:inline">下一局</span>
          </button>
          <!-- Error tooltip -->
          <div
            v-if="nextHandError"
            class="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none"
          >
            {{ nextHandError }}
            <div
              class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-800"
            ></div>
          </div>
        </div>

        <button
          @click="leaveRoom"
          class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/30"
          title="离开房间"
        >
          <LogOut class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span class="text-[10px] sm:text-xs font-medium hidden xs:inline">离开</span>
        </button>

        <a
          href="https://github.com/StreakingMan/texas-holdem"
          target="_blank"
          rel="noopener noreferrer"
          class="hidden sm:flex p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          title="GitHub"
        >
          <Github class="w-4 h-4" />
        </a>
      </div>
    </header>

    <!-- Connection status -->
    <div v-if="isConnecting" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div
          class="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"
        ></div>
        <p class="text-white text-lg">
          {{ isHost ? "创建房间中..." : "连接房间中..." }}
        </p>
      </div>
    </div>

    <!-- Connection error -->
    <div
      v-else-if="connectionError"
      class="flex-1 flex items-center justify-center"
    >
      <div class="text-center max-w-md mx-auto p-6">
        <div
          class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <span class="text-3xl">❌</span>
        </div>
        <p class="text-white text-lg mb-2">连接失败</p>
        <p class="text-gray-400 mb-6">{{ connectionError }}</p>
        <button
          @click="router.push('/')"
          class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          返回首页
        </button>
      </div>
    </div>

    <!-- Main game area -->
    <main v-else class="flex-1 flex overflow-hidden">
      <!-- Left: Game area (table + action panel) -->
      <div class="flex-1 relative min-w-0">
        <!-- Game table with action panel slot -->
        <PokerTable
          :players="gameStore.players"
          :community-cards="gameStore.communityCards"
          :pot="gameStore.totalPot"
          :phase="gameStore.phase"
          :current-player-id="gameStore.currentPlayer?.id"
          :winners="gameStore.winners"
          :local-player-id="playerStore.playerId"
          :player-bubbles="playerBubbles"
          :last-action="lastActionInfo"
          :is-host="isHost"
          :tip-effects="activeTipEffects"
          :turn-start-time="gameStore.gameState?.turnStartTime"
          :turn-time-limit="gameStore.gameState?.turnTimeLimit"
          :has-used-extension="gameStore.gameState?.hasUsedExtension"
          @tip="sendTip"
          @open-hand-rankings="openHelpModal('hand-rankings')"
          @request-extension="requestExtension"
        >
          <!-- Action panel in slot -->
          <template #action-panel>
            <ActionPanel
              v-if="gameStore.isGameStarted && !showLobby"
              :is-my-turn="game.isMyTurn.value"
              :available-actions="game.availableActions.value"
              :call-amount="game.callAmount.value"
              :min-raise="game.minRaise.value"
              :max-raise="game.maxRaise.value"
              :current-bet="gameStore.gameState?.currentBet || 0"
              :player-chips="game.localPlayer.value?.chips || 0"
              :is-host="isHost"
              :is-game-ended="gameStore.phase === 'ended' || gameStore.phase === 'showdown'"
              @action="handleAction"
              @next-hand="nextHand"
            />
          </template>
        </PokerTable>

        <!-- Lobby overlay -->
        <LobbyPanel
          v-if="showLobby"
          :players="gameStore.players"
          :is-host="isHost"
          :room-id="roomId"
          :can-start="canStartGame"
          @start="startGame"
        />

        <!-- Winner/Loser Celebration Overlay -->
        <Transition name="celebration">
          <div
            v-if="showWinnerCelebration"
            class="absolute inset-0 pointer-events-none overflow-hidden z-50"
          >
            <!-- Winner effects -->
            <template v-if="isLocalPlayerWinner">
              <!-- Confetti particles -->
              <div class="confetti-container">
                <div
                  v-for="i in 50"
                  :key="i"
                  class="confetti"
                  :style="`--i: ${i}`"
                ></div>
              </div>

              <!-- Golden light rays -->
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="winner-rays"></div>
              </div>

              <!-- Winner banner -->
              <div class="absolute inset-x-0 top-1/3 flex justify-center">
                <div class="winner-banner">
                  <span
                    class="text-4xl font-bold text-amber-400 drop-shadow-lg animate-pulse"
                  >
                    🏆 胜利! 🏆
                  </span>
                </div>
              </div>
            </template>

            <!-- Loser effects -->
            <template v-else>
              <!-- Dark overlay -->
              <div class="absolute inset-0 bg-gray-900/60"></div>

              <!-- Loser banner -->
              <div class="absolute inset-x-0 top-1/3 flex justify-center">
                <div class="loser-banner">
                  <span class="text-3xl font-bold text-gray-400 drop-shadow-lg">
                    💔 惜败 💔
                  </span>
                  <p class="text-gray-500 mt-2 text-sm">下一局再战！</p>
                </div>
              </div>
            </template>
          </div>
        </Transition>
      </div>

      <!-- Side panel (history on top, chat on bottom) - Hidden on mobile -->
      <aside
        ref="sidebarRef"
        class="hidden md:flex w-80 bg-gray-900/80 backdrop-blur border-l border-gray-700/50 flex-col"
      >
        <!-- Action history (top) -->
        <div
          class="overflow-hidden shrink-0"
          :style="{ height: historyPanelHeight + '%' }"
        >
          <ActionHistory :records="gameStore.actionHistory" />
        </div>

        <!-- Resize handle -->
        <div
          class="h-1 bg-gray-700/50 hover:bg-amber-500/50 cursor-row-resize shrink-0 transition-colors group relative"
          :class="{ 'bg-amber-500/50': isResizing }"
          @mousedown="startResize"
        >
          <!-- Drag indicator -->
          <div
            class="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center"
          >
            <div
              class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              :class="{ 'opacity-100': isResizing }"
            >
              <div class="w-1 h-1 rounded-full bg-gray-400"></div>
              <div class="w-1 h-1 rounded-full bg-gray-400"></div>
              <div class="w-1 h-1 rounded-full bg-gray-400"></div>
            </div>
          </div>
        </div>

        <!-- Chat (bottom) -->
        <div class="flex-1 overflow-hidden min-h-0">
          <ChatBox
            :messages="chat.messages.value"
            :local-player-id="playerStore.playerId"
            @send="sendChatMessage"
          />
        </div>
      </aside>

      <!-- Mobile floating buttons (show on mobile when game started) -->
      <div 
        v-if="gameStore.isGameStarted && !showLobby"
        class="md:hidden fixed bottom-20 right-2 flex flex-col gap-1.5 z-40"
      >
        <!-- Chat button -->
        <button
          @click="openMobileDrawer('chat')"
          class="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
        >
          <MessageCircle class="w-4 h-4" />
        </button>
        <!-- History button -->
        <button
          @click="openMobileDrawer('history')"
          class="w-10 h-10 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
        >
          <History class="w-4 h-4" />
        </button>
      </div>

      <!-- Mobile drawer -->
      <Transition name="drawer">
        <div
          v-if="showMobileDrawer"
          class="md:hidden fixed inset-0 z-50"
        >
          <!-- Backdrop -->
          <div 
            class="absolute inset-0 bg-black/60" 
            @click="closeMobileDrawer"
          ></div>
          
          <!-- Drawer panel -->
          <div class="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-gray-900 border-l border-gray-700/50 flex flex-col">
            <!-- Drawer header -->
            <div class="flex items-center justify-between p-3 border-b border-gray-700/50">
              <div class="flex gap-2">
                <button
                  @click="mobileDrawerTab = 'chat'"
                  class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  :class="mobileDrawerTab === 'chat' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'text-gray-400 hover:text-white'"
                >
                  <MessageCircle class="w-4 h-4 inline mr-1" />
                  聊天
                </button>
                <button
                  @click="mobileDrawerTab = 'history'"
                  class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  :class="mobileDrawerTab === 'history' 
                    ? 'bg-purple-500/20 text-purple-400' 
                    : 'text-gray-400 hover:text-white'"
                >
                  <History class="w-4 h-4 inline mr-1" />
                  记录
                </button>
              </div>
              <button
                @click="closeMobileDrawer"
                class="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X class="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <!-- Drawer content -->
            <div class="flex-1 overflow-hidden">
              <ChatBox
                v-if="mobileDrawerTab === 'chat'"
                :messages="chat.messages.value"
                :local-player-id="playerStore.playerId"
                @send="sendChatMessage"
              />
              <ActionHistory
                v-else
                :records="gameStore.actionHistory"
              />
            </div>
          </div>
        </div>
      </Transition>
    </main>

    <!-- Help Modal -->
    <HelpModal
      :show="showHelpModal"
      :type="helpModalType"
      :player-cards="game.localPlayer.value?.cards || []"
      :community-cards="gameStore.communityCards"
      :phase="gameStore.phase"
      @close="showHelpModal = false"
    />

    <!-- Host Disconnected Overlay -->
    <Transition name="fade">
      <div
        v-if="hostDisconnected"
        class="fixed inset-0 bg-gray-900/90 backdrop-blur-sm flex items-center justify-center z-200"
      >
        <div class="bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center max-w-sm mx-4">
          <div class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogOut class="w-8 h-8 text-red-400" />
          </div>
          <h2 class="text-xl font-bold text-white mb-2">房主已离开</h2>
          <p class="text-gray-400 mb-4">房间已关闭，即将返回首页...</p>
          <button
            @click="router.push('/')"
            class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            立即返回
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Winner celebration transitions */
.celebration-enter-active {
  animation: celebration-in 0.5s ease-out;
}
.celebration-leave-active {
  animation: celebration-out 1s ease-in;
}

@keyframes celebration-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes celebration-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* Confetti */
.confetti-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.confetti {
  position: absolute;
  width: 10px;
  height: 10px;
  top: -20px;
  left: calc(var(--i) * 2%);
  background: linear-gradient(
    135deg,
    hsl(calc(var(--i) * 7.2), 80%, 60%),
    hsl(calc(var(--i) * 7.2 + 30), 80%, 50%)
  );
  animation: confetti-fall 3s ease-in-out calc(var(--i) * 0.05s) forwards;
  transform-origin: center;
}

.confetti:nth-child(odd) {
  border-radius: 50%;
}

.confetti:nth-child(3n) {
  width: 8px;
  height: 16px;
  border-radius: 2px;
}

.confetti:nth-child(5n) {
  width: 6px;
  height: 6px;
}

@keyframes confetti-fall {
  0% {
    opacity: 1;
    transform: translateY(0) rotate(0deg) scale(1);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(100vh) rotate(calc(var(--i) * 60deg)) scale(0.5);
  }
}

/* Winner light rays */
.winner-rays {
  width: 400px;
  height: 400px;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(251, 191, 36, 0.3) 10deg,
    transparent 20deg,
    transparent 30deg,
    rgba(251, 191, 36, 0.2) 40deg,
    transparent 50deg,
    transparent 60deg,
    rgba(251, 191, 36, 0.3) 70deg,
    transparent 80deg,
    transparent 90deg
  );
  border-radius: 50%;
  animation: rays-spin 4s linear infinite;
  filter: blur(20px);
}

@keyframes rays-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Winner banner */
.winner-banner {
  padding: 20px 60px;
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.8),
    rgba(20, 20, 20, 0.9)
  );
  border: 3px solid #fbbf24;
  border-radius: 20px;
  box-shadow: 0 0 40px rgba(251, 191, 36, 0.5), 0 0 80px rgba(251, 191, 36, 0.3),
    inset 0 0 20px rgba(251, 191, 36, 0.1);
  animation: banner-pulse 1s ease-in-out infinite;
}

/* Loser banner */
.loser-banner {
  padding: 20px 60px;
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.9),
    rgba(30, 30, 30, 0.95)
  );
  border: 2px solid #6b7280;
  border-radius: 20px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 0, 0, 0.3);
  animation: loser-fade 2s ease-in-out;
  text-align: center;
}

@keyframes loser-fade {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  20% {
    opacity: 1;
    transform: scale(1);
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0.8;
  }
}

@keyframes banner-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 40px rgba(251, 191, 36, 0.5),
      0 0 80px rgba(251, 191, 36, 0.3), inset 0 0 20px rgba(251, 191, 36, 0.1);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 60px rgba(251, 191, 36, 0.7),
      0 0 100px rgba(251, 191, 36, 0.5), inset 0 0 30px rgba(251, 191, 36, 0.2);
  }
}

/* Mobile drawer transitions */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-enter-active > div:last-child,
.drawer-leave-active > div:last-child {
  transition: transform 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from > div:last-child,
.drawer-leave-to > div:last-child {
  transform: translateX(100%);
}
</style>
