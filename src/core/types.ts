// Card suits and ranks
export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

// Hand rankings (from highest to lowest)
export type HandRank =
  | "royal-flush"
  | "straight-flush"
  | "four-of-a-kind"
  | "full-house"
  | "flush"
  | "straight"
  | "three-of-a-kind"
  | "two-pair"
  | "one-pair"
  | "high-card";

export interface HandResult {
  rank: HandRank;
  rankValue: number;
  cards: Card[];
  kickers: number[];
  description: string;
}

// Player actions
export type PlayerAction = "fold" | "check" | "call" | "raise" | "all-in";

export interface PlayerActionData {
  action: PlayerAction;
  amount?: number;
}

// Game phases
export type GamePhase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "ended";

// Player state
export interface Player {
  id: string;
  name: string;
  avatar?: string;
  chips: number;
  cards: Card[];
  bet: number;
  totalBet: number;
  folded: boolean;
  isAllIn: boolean;
  isActive: boolean;
  isTurn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  seatIndex: number;
  isConnected: boolean;
  hasActedThisRound: boolean;
  joinedMidGame?: boolean; // 中途加入标记，下一局开始时重置
}

// Pot information
export interface Pot {
  amount: number;
  eligiblePlayers: string[];
}

// Game state
export interface GameState {
  phase: GamePhase;
  players: Player[];
  communityCards: Card[];
  pots: Pot[];
  currentBet: number;
  minRaise: number;
  dealerIndex: number;
  currentPlayerIndex: number;
  smallBlind: number;
  bigBlind: number;
  lastAction?: {
    playerId: string;
    action: PlayerAction;
    amount?: number;
    phase: GamePhase; // 动作发生时的阶段
  };
  winners?: WinnerInfo[];
  // 回合计时相关
  turnStartTime?: number; // 当前回合开始时间戳
  turnTimeLimit?: number; // 当前回合时间限制（秒），默认30
  hasUsedExtension?: boolean; // 当前玩家是否已使用延时
}

// Winner information
export interface WinnerInfo {
  playerId: string;
  potIndex: number;
  amount: number;
  hand: HandResult;
}

// Room state
export interface RoomState {
  roomId: string;
  hostId: string;
  players: Player[];
  gameState: GameState | null;
  settings: GameSettings;
  isGameStarted: boolean;
}

// Game settings
export interface GameSettings {
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  turnTimeLimit: number; // in seconds, 0 for no limit
}

// P2P Message types
export type MessageType =
  | "player-join"
  | "player-leave"
  | "player-left"
  | "player-ready"
  | "game-state"
  | "player-action"
  | "chat-message"
  | "start-game"
  | "room-state"
  | "tip-player"
  | "add-chips"
  | "request-extension" // 请求延时
  | "kick-player" // 房主踢人
  | "kicked" // 通知被踢玩家
  | "error"
  | "ping"
  | "pong";

export interface P2PMessage<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: number;
  senderId: string;
}

// Chat message
export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  content: string;
  timestamp: number;
}

// Player join payload
export interface PlayerJoinPayload {
  player: {
    id: string;
    name: string;
    avatar?: string;
  };
}

// Player action payload
export interface PlayerActionPayload {
  playerId: string;
  action: PlayerAction;
  amount?: number;
}

// Error payload
export interface ErrorPayload {
  code: string;
  message: string;
}

// Tip payload
export interface TipPayload {
  fromPlayerId: string;
  fromPlayerName: string;
  fromPlayerAvatar?: string;
  toPlayerId: string;
  toPlayerName: string;
  toPlayerAvatar?: string;
  amount: number;
}

// Add chips payload
export interface AddChipsPayload {
  amount: number;
}

// Request extension payload
export interface RequestExtensionPayload {
  playerId: string;
}

// Kick player payload
export interface KickPlayerPayload {
  playerId: string;
  playerName: string;
  reason?: string;
}
