import type {
  Card,
  GameState,
  Player,
  PlayerAction,
  GameSettings,
} from "./types";
import { Deck } from "./deck";
import { findWinners } from "./hand-evaluator";

export const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 9,
  smallBlind: 10,
  bigBlind: 20,
  startingChips: 1000,
  turnTimeLimit: 30,
};

/**
 * Create initial game state
 */
export function createInitialGameState(
  settings: GameSettings = DEFAULT_SETTINGS
): GameState {
  return {
    phase: "waiting",
    players: [],
    communityCards: [],
    pots: [{ amount: 0, eligiblePlayers: [] }],
    currentBet: 0,
    minRaise: settings.bigBlind,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    smallBlind: settings.smallBlind,
    bigBlind: settings.bigBlind,
  };
}

/**
 * Create a new player
 */
export function createPlayer(
  id: string,
  name: string,
  seatIndex: number,
  chips: number,
  avatar?: string
): Player {
  return {
    id,
    name,
    avatar,
    chips,
    cards: [],
    bet: 0,
    totalBet: 0,
    folded: false,
    isAllIn: false,
    isActive: true,
    isTurn: false,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    seatIndex,
    isConnected: true,
    hasActedThisRound: false,
  };
}

/**
 * Texas Hold'em Game Engine
 */
export class GameEngine {
  private deck: Deck;
  private state: GameState;
  private settings: GameSettings;

  constructor(settings: GameSettings = DEFAULT_SETTINGS) {
    this.deck = new Deck();
    this.settings = settings;
    this.state = createInitialGameState(settings);
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return { ...this.state };
  }

  /**
   * Get current game settings
   */
  getSettings(): GameSettings {
    return { ...this.settings };
  }

  /**
   * Get state for a specific player (hides other players' cards)
   */
  getStateForPlayer(playerId: string): GameState {
    const state = { ...this.state };
    state.players = state.players.map((p) => {
      if (p.id === playerId || state.phase === "showdown") {
        return { ...p };
      }
      // Hide other players' cards - keep card count but clear content
      return {
        ...p,
        cards: p.cards.map(() => null) as unknown as Card[],
      };
    });
    return state;
  }

  /**
   * Add a player to the game
   * Supports mid-game joining: new player is folded for current hand, participates next hand
   */
  addPlayer(player: Player): boolean {
    if (this.state.players.length >= this.settings.maxPlayers) {
      return false;
    }
    if (this.state.players.find((p) => p.id === player.id)) {
      return false;
    }

    // If game is in progress, mark as mid-game join with folded state
    const isGameInProgress = this.state.phase !== "waiting";
    if (isGameInProgress) {
      player.folded = true;
      player.joinedMidGame = true;
      player.cards = [];
      player.bet = 0;
      player.totalBet = 0;
      player.isActive = false;
      player.isTurn = false;
    }

    this.state.players.push(player);

    // Only add to pot eligibility if game hasn't started
    if (!isGameInProgress) {
      this.state.pots[0]!.eligiblePlayers.push(player.id);
    }

    return true;
  }

  /**
   * Remove a player from the game
   */
  removePlayer(playerId: string): boolean {
    const index = this.state.players.findIndex((p) => p.id === playerId);
    if (index === -1) return false;

    this.state.players.splice(index, 1);

    // Remove from pot eligibility
    for (const pot of this.state.pots) {
      pot.eligiblePlayers = pot.eligiblePlayers.filter((id) => id !== playerId);
    }

    return true;
  }

  /**
   * Start a new hand
   */
  startHand(): boolean {
    const activePlayers = this.state.players.filter(
      (p) => p.chips > 0 && p.isConnected
    );
    if (activePlayers.length < 2) {
      return false;
    }

    // Reset deck
    this.deck.reset();

    // Reset player states
    for (const player of this.state.players) {
      player.cards = [];
      player.bet = 0;
      player.totalBet = 0;
      player.folded = player.chips <= 0 || !player.isConnected;
      player.isAllIn = false;
      player.isTurn = false;
      player.isDealer = false;
      player.isSmallBlind = false;
      player.joinedMidGame = false; // Reset mid-game join flag for new hand
      player.isBigBlind = false;
      player.hasActedThisRound = false;
    }

    // Reset game state
    this.state.communityCards = [];
    this.state.pots = [
      { amount: 0, eligiblePlayers: activePlayers.map((p) => p.id) },
    ];
    this.state.currentBet = 0;
    this.state.minRaise = this.settings.bigBlind;
    this.state.winners = undefined;
    this.state.lastAction = undefined;

    // Move dealer button
    this.state.dealerIndex = this.findNextActivePlayer(this.state.dealerIndex);

    // Set dealer, blinds
    const dealerPlayer = this.getActivePlayerAt(this.state.dealerIndex);
    if (dealerPlayer) dealerPlayer.isDealer = true;

    // Post blinds
    this.postBlinds();

    // Deal hole cards
    this.dealHoleCards();

    // Set phase to preflop
    this.state.phase = "preflop";

    // Set first player to act (after big blind)
    const bigBlindIndex = this.findNextActivePlayer(
      this.findNextActivePlayer(this.state.dealerIndex)
    );
    this.state.currentPlayerIndex = this.findNextActivePlayer(bigBlindIndex);
    this.setCurrentPlayerTurn();

    return true;
  }

  /**
   * Get the reason why a new hand cannot be started
   * Returns null if a new hand can be started
   */
  getStartHandError(): string | null {
    const connectedPlayers = this.state.players.filter((p) => p.isConnected);
    const playersWithChips = connectedPlayers.filter((p) => p.chips > 0);

    if (connectedPlayers.length < 2) {
      return "等待更多玩家加入";
    }

    if (playersWithChips.length < 2) {
      // Find the winner (the one with chips)
      const winner = playersWithChips[0];
      if (winner) {
        return `🏆 ${winner.name} 赢得了所有筹码！游戏结束`;
      }
      return "所有玩家筹码耗尽";
    }

    // Check for eliminated players
    const eliminatedPlayers = connectedPlayers.filter((p) => p.chips <= 0);
    if (eliminatedPlayers.length > 0) {
      const names = eliminatedPlayers.map((p) => p.name).join("、");
      return `${names} 已出局`;
    }

    return null;
  }

  /**
   * Post small and big blinds
   */
  private postBlinds(): void {
    const activePlayers = this.state.players.filter((p) => !p.folded);

    if (activePlayers.length === 2) {
      // Heads-up: dealer posts small blind
      const sbIndex = this.state.dealerIndex;
      const bbIndex = this.findNextActivePlayer(sbIndex);

      this.postBlind(sbIndex, this.settings.smallBlind, true);
      this.postBlind(bbIndex, this.settings.bigBlind, false);
    } else {
      // Normal: player after dealer posts small blind
      const sbIndex = this.findNextActivePlayer(this.state.dealerIndex);
      const bbIndex = this.findNextActivePlayer(sbIndex);

      this.postBlind(sbIndex, this.settings.smallBlind, true);
      this.postBlind(bbIndex, this.settings.bigBlind, false);
    }

    this.state.currentBet = this.settings.bigBlind;
  }

  private postBlind(
    playerIndex: number,
    amount: number,
    isSmallBlind: boolean
  ): void {
    const player = this.getActivePlayerAt(playerIndex);
    if (!player) return;

    const actualAmount = Math.min(amount, player.chips);
    player.chips -= actualAmount;
    player.bet = actualAmount;
    player.totalBet = actualAmount;
    this.state.pots[0]!.amount += actualAmount;

    if (isSmallBlind) {
      player.isSmallBlind = true;
    } else {
      player.isBigBlind = true;
    }

    if (player.chips === 0) {
      player.isAllIn = true;
    }
  }

  /**
   * Deal hole cards to all active players
   */
  private dealHoleCards(): void {
    const activePlayers = this.state.players.filter((p) => !p.folded);

    // Deal 2 cards to each player
    for (let i = 0; i < 2; i++) {
      for (const player of activePlayers) {
        const card = this.deck.deal();
        if (card) {
          player.cards.push(card);
        }
      }
    }
  }

  /**
   * Process a player action
   */
  processAction(
    playerId: string,
    action: PlayerAction,
    amount?: number
  ): boolean {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || !player.isTurn || player.folded) {
      return false;
    }

    const validActions = this.getValidActions(playerId);
    if (!validActions.includes(action)) {
      return false;
    }

    switch (action) {
      case "fold":
        this.handleFold(player);
        break;
      case "check":
        if (!this.canCheck(player)) return false;
        this.handleCheck(player);
        break;
      case "call":
        this.handleCall(player);
        break;
      case "raise":
        if (amount === undefined || !this.canRaise(player, amount))
          return false;
        this.handleRaise(player, amount);
        // Reset other players' action status when someone raises
        for (const p of this.state.players) {
          if (p.id !== player.id && !p.folded && !p.isAllIn) {
            p.hasActedThisRound = false;
          }
        }
        break;
      case "all-in": {
        const prevBet = this.state.currentBet;
        this.handleAllIn(player);
        // If all-in raised the bet, reset other players' action status
        if (this.state.currentBet > prevBet) {
          for (const p of this.state.players) {
            if (p.id !== player.id && !p.folded && !p.isAllIn) {
              p.hasActedThisRound = false;
            }
          }
        }
        break;
      }
    }

    player.hasActedThisRound = true;
    // 记录动作时保存当前阶段，因为后续 advancePhase/endHand 会改变 phase
    this.state.lastAction = {
      playerId,
      action,
      amount,
      phase: this.state.phase,
    };

    // Check if hand is over
    if (this.isHandOver()) {
      this.endHand();
      return true;
    }

    // Check if betting round is over
    if (this.isBettingRoundOver()) {
      this.advancePhase();
    } else {
      this.advanceToNextPlayer();
    }

    return true;
  }

  /**
   * Get valid actions for a player
   */
  getValidActions(playerId: string): PlayerAction[] {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || player.folded || player.isAllIn) {
      return [];
    }

    const actions: PlayerAction[] = ["fold"];

    if (this.canCheck(player)) {
      actions.push("check");
    }

    if (this.canCall(player)) {
      actions.push("call");
    }

    if (this.canRaise(player)) {
      actions.push("raise");
    }

    if (player.chips > 0) {
      actions.push("all-in");
    }

    return actions;
  }

  /**
   * Get minimum raise amount
   */
  getMinRaise(): number {
    return this.state.minRaise;
  }

  /**
   * Get maximum raise amount for a player
   */
  getMaxRaise(playerId: string): number {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return 0;
    return player.chips + player.bet - this.state.currentBet;
  }

  /**
   * Get call amount for a player
   */
  getCallAmount(playerId: string): number {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return 0;
    return Math.min(this.state.currentBet - player.bet, player.chips);
  }

  private canCheck(player: Player): boolean {
    return player.bet >= this.state.currentBet;
  }

  private canCall(player: Player): boolean {
    return player.bet < this.state.currentBet && player.chips > 0;
  }

  private canRaise(player: Player, amount?: number): boolean {
    // amount 是加注增量（加注到 currentBet + amount）
    // minRaiseIncrement: 最小加注增量
    const minRaiseIncrement = this.state.minRaise;
    // maxRaiseIncrement: 玩家能加的最大增量
    const maxRaiseIncrement = player.chips + player.bet - this.state.currentBet;

    if (amount !== undefined) {
      return amount >= minRaiseIncrement && amount <= maxRaiseIncrement;
    }

    return maxRaiseIncrement >= minRaiseIncrement;
  }

  private handleFold(player: Player): void {
    player.folded = true;
    player.isTurn = false;

    // Remove from pot eligibility
    for (const pot of this.state.pots) {
      pot.eligiblePlayers = pot.eligiblePlayers.filter(
        (id) => id !== player.id
      );
    }
  }

  private handleCheck(player: Player): void {
    player.isTurn = false;
  }

  private handleCall(player: Player): void {
    const callAmount = Math.min(
      this.state.currentBet - player.bet,
      player.chips
    );
    player.chips -= callAmount;
    player.bet += callAmount;
    player.totalBet += callAmount;
    this.state.pots[0]!.amount += callAmount;

    if (player.chips === 0) {
      player.isAllIn = true;
    }

    player.isTurn = false;
  }

  private handleRaise(player: Player, amount: number): void {
    const totalBet = this.state.currentBet + amount;
    const raiseAmount = totalBet - player.bet;

    player.chips -= raiseAmount;
    player.bet = totalBet;
    player.totalBet += raiseAmount;
    this.state.pots[0]!.amount += raiseAmount;

    this.state.minRaise = amount;
    this.state.currentBet = totalBet;

    if (player.chips === 0) {
      player.isAllIn = true;
    }

    player.isTurn = false;
  }

  private handleAllIn(player: Player): void {
    const allInAmount = player.chips;
    const newBet = player.bet + allInAmount;

    if (newBet > this.state.currentBet) {
      const raise = newBet - this.state.currentBet;
      if (raise >= this.state.minRaise) {
        this.state.minRaise = raise;
      }
      this.state.currentBet = newBet;
    }

    player.chips = 0;
    player.bet = newBet;
    player.totalBet += allInAmount;
    player.isAllIn = true;
    this.state.pots[0]!.amount += allInAmount;

    player.isTurn = false;
  }

  private findNextActivePlayer(fromIndex: number): number {
    const players = this.state.players;
    let index = (fromIndex + 1) % players.length;
    let count = 0;

    while (count < players.length) {
      const player = players[index]!;
      if (!player.folded && player.chips > 0 && player.isConnected) {
        return index;
      }
      index = (index + 1) % players.length;
      count++;
    }

    return fromIndex;
  }

  private getActivePlayerAt(index: number): Player | null {
    const player = this.state.players[index];
    if (player && !player.folded) {
      return player;
    }
    return null;
  }

  private setCurrentPlayerTurn(): void {
    for (const player of this.state.players) {
      player.isTurn = false;
    }
    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (currentPlayer && !currentPlayer.folded && !currentPlayer.isAllIn) {
      currentPlayer.isTurn = true;
    }
  }

  private advanceToNextPlayer(): void {
    let nextIndex = this.state.currentPlayerIndex;
    let attempts = 0;

    do {
      nextIndex = (nextIndex + 1) % this.state.players.length;
      attempts++;
    } while (
      attempts < this.state.players.length &&
      (this.state.players[nextIndex]!.folded ||
        this.state.players[nextIndex]!.isAllIn)
    );

    this.state.currentPlayerIndex = nextIndex;
    this.setCurrentPlayerTurn();
  }

  private isBettingRoundOver(): boolean {
    const activePlayers = this.state.players.filter(
      (p) => !p.folded && !p.isAllIn
    );

    if (activePlayers.length === 0) {
      return true;
    }

    // All active players must have acted this round AND matched the current bet
    return activePlayers.every(
      (p) => p.hasActedThisRound && p.bet === this.state.currentBet
    );
  }

  private isHandOver(): boolean {
    const activePlayers = this.state.players.filter((p) => !p.folded);

    // Only one player left
    if (activePlayers.length === 1) {
      return true;
    }

    // All players all-in (except possibly one)
    const notAllIn = activePlayers.filter((p) => !p.isAllIn);
    if (notAllIn.length <= 1 && this.isBettingRoundOver()) {
      return this.state.phase === "river" || this.shouldGoToShowdown();
    }

    return false;
  }

  private shouldGoToShowdown(): boolean {
    const activePlayers = this.state.players.filter((p) => !p.folded);
    const notAllIn = activePlayers.filter((p) => !p.isAllIn);
    return notAllIn.length <= 1;
  }

  private advancePhase(): void {
    // Reset bets and action status for new round
    for (const player of this.state.players) {
      player.bet = 0;
      player.hasActedThisRound = false;
    }
    this.state.currentBet = 0;

    // Calculate side pots if needed
    this.calculateSidePots();

    switch (this.state.phase) {
      case "preflop":
        this.state.phase = "flop";
        this.dealCommunityCards(3);
        break;
      case "flop":
        this.state.phase = "turn";
        this.dealCommunityCards(1);
        break;
      case "turn":
        this.state.phase = "river";
        this.dealCommunityCards(1);
        break;
      case "river":
        this.state.phase = "showdown";
        this.endHand();
        return;
    }

    // If everyone is all-in, deal remaining cards
    if (this.shouldGoToShowdown()) {
      this.dealRemainingCards();
      this.endHand();
      return;
    }

    // Set first player to act (player after dealer)
    this.state.currentPlayerIndex = this.findNextActivePlayer(
      this.state.dealerIndex
    );
    this.setCurrentPlayerTurn();
  }

  private dealCommunityCards(count: number): void {
    this.deck.burn();
    for (let i = 0; i < count; i++) {
      const card = this.deck.deal();
      if (card) {
        this.state.communityCards.push(card);
      }
    }
  }

  private dealRemainingCards(): void {
    while (this.state.communityCards.length < 5) {
      if (this.state.communityCards.length === 0) {
        this.dealCommunityCards(3);
      } else {
        this.dealCommunityCards(1);
      }
    }
    this.state.phase = "showdown";
  }

  private calculateSidePots(): void {
    const activePlayers = this.state.players.filter((p) => !p.folded);
    const allInPlayers = activePlayers
      .filter((p) => p.isAllIn)
      .sort((a, b) => a.totalBet - b.totalBet);

    if (allInPlayers.length === 0) return;

    // Simple pot calculation - can be expanded for complex side pots
    const totalPot = activePlayers.reduce((sum, p) => sum + p.totalBet, 0);
    this.state.pots = [
      {
        amount: totalPot,
        eligiblePlayers: activePlayers.map((p) => p.id),
      },
    ];
  }

  private endHand(): void {
    const activePlayers = this.state.players.filter((p) => !p.folded);

    // Single winner (everyone else folded)
    if (activePlayers.length === 1) {
      const winner = activePlayers[0]!;
      const totalPot = this.state.pots.reduce((sum, p) => sum + p.amount, 0);
      winner.chips += totalPot;

      this.state.winners = [
        {
          playerId: winner.id,
          potIndex: 0,
          amount: totalPot,
          hand: {
            rank: "high-card",
            rankValue: 1,
            cards: [],
            kickers: [],
            description: "其他玩家弃牌",
          },
        },
      ];
    } else {
      // Multiple players - need to showdown
      // First, deal remaining community cards if not enough
      while (this.state.communityCards.length < 5) {
        this.deck.burn();
        const card = this.deck.deal();
        if (card) {
          this.state.communityCards.push(card);
        }
      }

      // Showdown - determine winner(s)
      this.state.phase = "showdown";

      const playerHands = activePlayers.map((p) => ({
        playerId: p.id,
        cards: p.cards,
        communityCards: this.state.communityCards,
      }));

      const winners = findWinners(playerHands);
      const totalPot = this.state.pots.reduce((sum, p) => sum + p.amount, 0);
      const splitAmount = Math.floor(totalPot / winners.length);

      this.state.winners = winners.map((w, i) => {
        const player = this.state.players.find((p) => p.id === w.playerId);
        if (player) {
          // Handle odd chips - give to first winner
          const amount =
            i === 0 ? splitAmount + (totalPot % winners.length) : splitAmount;
          player.chips += amount;
          return {
            playerId: w.playerId,
            potIndex: 0,
            amount,
            hand: w.hand,
          };
        }
        return {
          playerId: w.playerId,
          potIndex: 0,
          amount: splitAmount,
          hand: w.hand,
        };
      });
    }

    this.state.phase = "ended";

    // Clear turn indicator
    for (const player of this.state.players) {
      player.isTurn = false;
    }
  }

  /**
   * Reset for next hand
   */
  resetForNextHand(): void {
    // Remove players with no chips
    this.state.players = this.state.players.filter(
      (p) => p.chips > 0 || !p.isConnected
    );
    this.state.phase = "waiting";
  }

  /**
   * Process a tip from one player to another
   * @param fromId - The ID of the player giving the tip
   * @param toId - The ID of the player receiving the tip
   * @param amount - The amount to tip
   * @returns true if the tip was successful, false otherwise
   */
  tipPlayer(fromId: string, toId: string, amount: number): boolean {
    // Validate amount
    if (amount <= 0) {
      return false;
    }

    // Find both players
    const fromPlayer = this.state.players.find((p) => p.id === fromId);
    const toPlayer = this.state.players.find((p) => p.id === toId);

    if (!fromPlayer || !toPlayer) {
      return false;
    }

    // Check if fromPlayer has enough chips
    if (fromPlayer.chips < amount) {
      return false;
    }

    // Transfer chips
    fromPlayer.chips -= amount;
    toPlayer.chips += amount;

    return true;
  }

  /**
   * Add chips to all connected players and update starting chips setting
   * @param amount - The amount of chips to add to each player
   */
  addChipsToAll(amount: number): void {
    if (amount <= 0) return;

    // Add chips to all connected players
    for (const player of this.state.players) {
      if (player.isConnected) {
        player.chips += amount;
      }
    }

    // Update starting chips setting
    this.settings.startingChips += amount;
  }
}
