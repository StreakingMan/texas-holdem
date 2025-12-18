import type { Card, Suit, Rank } from "./types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

/**
 * Creates a standard 52-card deck
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle algorithm
 * Creates a new shuffled array without modifying the original
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

/**
 * Deck manager class for dealing cards
 */
export class Deck {
  private cards: Card[];
  private dealtCards: Card[] = [];

  constructor() {
    this.cards = shuffleDeck(createDeck());
  }

  /**
   * Deal a single card from the deck
   */
  deal(): Card | null {
    const card = this.cards.pop();
    if (card) {
      this.dealtCards.push(card);
      return card;
    }
    return null;
  }

  /**
   * Deal multiple cards from the deck
   */
  dealMultiple(count: number): Card[] {
    const cards: Card[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.deal();
      if (card) {
        cards.push(card);
      }
    }
    return cards;
  }

  /**
   * Burn a card (discard without revealing)
   */
  burn(): void {
    this.deal();
  }

  /**
   * Get remaining card count
   */
  get remaining(): number {
    return this.cards.length;
  }

  /**
   * Reset the deck with a fresh shuffle
   */
  reset(): void {
    this.cards = shuffleDeck(createDeck());
    this.dealtCards = [];
  }
}

/**
 * Get the numeric value of a rank for comparison
 */
export function getRankValue(rank: Rank): number {
  const values: Record<Rank, number> = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  };
  return values[rank];
}

/**
 * Get the display symbol for a suit
 */
export function getSuitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };
  return symbols[suit];
}

/**
 * Get the color for a suit
 */
export function getSuitColor(suit: Suit): "red" | "black" {
  return suit === "hearts" || suit === "diamonds" ? "red" : "black";
}

/**
 * Convert card to string representation
 */
export function cardToString(card: Card): string {
  return `${card.rank}${getSuitSymbol(card.suit)}`;
}

/**
 * Compare two cards by rank value
 */
export function compareCards(a: Card, b: Card): number {
  return getRankValue(b.rank) - getRankValue(a.rank);
}
