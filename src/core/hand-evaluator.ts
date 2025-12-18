import type { Card, HandRank, HandResult, Rank, Suit } from "./types";
import { getRankValue } from "./deck";

// Hand rank values (higher is better)
const HAND_RANK_VALUES: Record<HandRank, number> = {
  "royal-flush": 10,
  "straight-flush": 9,
  "four-of-a-kind": 8,
  "full-house": 7,
  flush: 6,
  straight: 5,
  "three-of-a-kind": 4,
  "two-pair": 3,
  "one-pair": 2,
  "high-card": 1,
};

const HAND_DESCRIPTIONS: Record<HandRank, string> = {
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

/**
 * Group cards by rank
 */
function groupByRank(cards: Card[]): Map<Rank, Card[]> {
  const groups = new Map<Rank, Card[]>();
  for (const card of cards) {
    const group = groups.get(card.rank) || [];
    group.push(card);
    groups.set(card.rank, group);
  }
  return groups;
}

/**
 * Group cards by suit
 */
function groupBySuit(cards: Card[]): Map<Suit, Card[]> {
  const groups = new Map<Suit, Card[]>();
  for (const card of cards) {
    const group = groups.get(card.suit) || [];
    group.push(card);
    groups.set(card.suit, group);
  }
  return groups;
}

/**
 * Check if cards form a straight, returns the high card value if true
 */
function getStraightHighCard(cards: Card[]): number | null {
  const values = [...new Set(cards.map((c) => getRankValue(c.rank)))].sort(
    (a, b) => b - a
  );

  // Check for Ace-low straight (A-2-3-4-5)
  if (
    values.includes(14) &&
    values.includes(2) &&
    values.includes(3) &&
    values.includes(4) &&
    values.includes(5)
  ) {
    return 5; // 5-high straight
  }

  // Check for regular straight
  for (let i = 0; i <= values.length - 5; i++) {
    let isStraight = true;
    for (let j = 0; j < 4; j++) {
      const curr = values[i + j];
      const next = values[i + j + 1];
      if (curr === undefined || next === undefined || curr - next !== 1) {
        isStraight = false;
        break;
      }
    }
    if (isStraight) {
      return values[i] ?? null;
    }
  }

  return null;
}

/**
 * Find flush cards (5+ cards of same suit)
 */
function getFlushCards(cards: Card[]): Card[] | null {
  const bySuit = groupBySuit(cards);
  for (const [, suitCards] of bySuit) {
    if (suitCards.length >= 5) {
      return suitCards
        .sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
        .slice(0, 5);
    }
  }
  return null;
}

/**
 * Find straight flush cards
 */
function getStraightFlushCards(
  cards: Card[]
): { cards: Card[]; highCard: number } | null {
  const bySuit = groupBySuit(cards);

  for (const [, suitCards] of bySuit) {
    if (suitCards.length >= 5) {
      const highCard = getStraightHighCard(suitCards);
      if (highCard !== null) {
        // Get the actual straight cards
        const values = suitCards.map((c) => ({
          card: c,
          value: getRankValue(c.rank),
        }));
        const straightCards: Card[] = [];

        // Handle ace-low straight
        if (highCard === 5) {
          for (const v of [5, 4, 3, 2, 14]) {
            const card = values.find((x) => x.value === v);
            if (card) straightCards.push(card.card);
          }
        } else {
          for (let v = highCard; v > highCard - 5; v--) {
            const card = values.find((x) => x.value === v);
            if (card) straightCards.push(card.card);
          }
        }

        return { cards: straightCards, highCard };
      }
    }
  }

  return null;
}

/**
 * Evaluate the best 5-card hand from 7 cards
 */
export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length < 5) {
    throw new Error("Need at least 5 cards to evaluate a hand");
  }

  const byRank = groupByRank(cards);
  const rankCounts = Array.from(byRank.entries())
    .map(([rank, cards]) => ({
      rank,
      count: cards.length,
      value: getRankValue(rank),
    }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  // Check for straight flush / royal flush
  const straightFlush = getStraightFlushCards(cards);
  if (straightFlush) {
    const isRoyal = straightFlush.highCard === 14;
    return {
      rank: isRoyal ? "royal-flush" : "straight-flush",
      rankValue: HAND_RANK_VALUES[isRoyal ? "royal-flush" : "straight-flush"],
      cards: straightFlush.cards,
      kickers: [straightFlush.highCard],
      description: isRoyal
        ? HAND_DESCRIPTIONS["royal-flush"]
        : `${HAND_DESCRIPTIONS["straight-flush"]} (${straightFlush.highCard}高)`,
    };
  }

  // Check for four of a kind
  const fourOfAKind = rankCounts.find((r) => r.count === 4);
  if (fourOfAKind) {
    const quadCards = byRank.get(fourOfAKind.rank as Rank)!;
    const kickerCards = cards
      .filter((c) => c.rank !== fourOfAKind.rank)
      .sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
    const kicker = kickerCards[0]!;

    return {
      rank: "four-of-a-kind",
      rankValue: HAND_RANK_VALUES["four-of-a-kind"],
      cards: [...quadCards, kicker],
      kickers: [fourOfAKind.value, getRankValue(kicker.rank)],
      description: `${HAND_DESCRIPTIONS["four-of-a-kind"]} (${fourOfAKind.rank})`,
    };
  }

  // Check for full house
  const threeOfAKind = rankCounts.find((r) => r.count === 3);
  const pairs = rankCounts.filter(
    (r) => r.count >= 2 && r.rank !== threeOfAKind?.rank
  );

  if (threeOfAKind && pairs.length > 0) {
    const tripCards = byRank.get(threeOfAKind.rank as Rank)!.slice(0, 3);
    const firstPair = pairs[0]!;
    const pairCards = byRank.get(firstPair.rank as Rank)!.slice(0, 2);

    return {
      rank: "full-house",
      rankValue: HAND_RANK_VALUES["full-house"],
      cards: [...tripCards, ...pairCards],
      kickers: [threeOfAKind.value, firstPair.value],
      description: `${HAND_DESCRIPTIONS["full-house"]} (${threeOfAKind.rank}满${firstPair.rank})`,
    };
  }

  // Check for flush
  const flushCards = getFlushCards(cards);
  if (flushCards) {
    return {
      rank: "flush",
      rankValue: HAND_RANK_VALUES["flush"],
      cards: flushCards,
      kickers: flushCards.map((c) => getRankValue(c.rank)),
      description: `${HAND_DESCRIPTIONS["flush"]} (${flushCards[0]!.rank}高)`,
    };
  }

  // Check for straight
  const straightHighCard = getStraightHighCard(cards);
  if (straightHighCard !== null) {
    // Get straight cards
    const sortedCards = [...cards].sort(
      (a, b) => getRankValue(b.rank) - getRankValue(a.rank)
    );
    const straightCards: Card[] = [];
    const usedValues = new Set<number>();

    if (straightHighCard === 5) {
      // Ace-low straight
      for (const v of [5, 4, 3, 2, 14]) {
        const card = sortedCards.find(
          (c) => getRankValue(c.rank) === v && !usedValues.has(v)
        );
        if (card) {
          straightCards.push(card);
          usedValues.add(v);
        }
      }
    } else {
      for (let v = straightHighCard; v > straightHighCard - 5; v--) {
        const card = sortedCards.find(
          (c) => getRankValue(c.rank) === v && !usedValues.has(v)
        );
        if (card) {
          straightCards.push(card);
          usedValues.add(v);
        }
      }
    }

    return {
      rank: "straight",
      rankValue: HAND_RANK_VALUES["straight"],
      cards: straightCards,
      kickers: [straightHighCard],
      description: `${HAND_DESCRIPTIONS["straight"]} (${straightHighCard}高)`,
    };
  }

  // Check for three of a kind
  if (threeOfAKind) {
    const tripCards = byRank.get(threeOfAKind.rank as Rank)!.slice(0, 3);
    const kickers = cards
      .filter((c) => c.rank !== threeOfAKind.rank)
      .sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
      .slice(0, 2);

    return {
      rank: "three-of-a-kind",
      rankValue: HAND_RANK_VALUES["three-of-a-kind"],
      cards: [...tripCards, ...kickers],
      kickers: [
        threeOfAKind.value,
        ...kickers.map((c) => getRankValue(c.rank)),
      ],
      description: `${HAND_DESCRIPTIONS["three-of-a-kind"]} (${threeOfAKind.rank})`,
    };
  }

  // Check for two pair
  const pairsOnly = rankCounts.filter((r) => r.count === 2);
  if (pairsOnly.length >= 2) {
    const pair1 = pairsOnly[0]!;
    const pair2 = pairsOnly[1]!;
    const highPair = byRank.get(pair1.rank as Rank)!.slice(0, 2);
    const lowPair = byRank.get(pair2.rank as Rank)!.slice(0, 2);
    const kickerCards = cards
      .filter((c) => c.rank !== pair1.rank && c.rank !== pair2.rank)
      .sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
    const kicker = kickerCards[0]!;

    return {
      rank: "two-pair",
      rankValue: HAND_RANK_VALUES["two-pair"],
      cards: [...highPair, ...lowPair, kicker],
      kickers: [pair1.value, pair2.value, getRankValue(kicker.rank)],
      description: `${HAND_DESCRIPTIONS["two-pair"]} (${pair1.rank}和${pair2.rank})`,
    };
  }

  // Check for one pair
  if (pairsOnly.length === 1) {
    const onlyPair = pairsOnly[0]!;
    const pairCards = byRank.get(onlyPair.rank as Rank)!.slice(0, 2);
    const kickers = cards
      .filter((c) => c.rank !== onlyPair.rank)
      .sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
      .slice(0, 3);

    return {
      rank: "one-pair",
      rankValue: HAND_RANK_VALUES["one-pair"],
      cards: [...pairCards, ...kickers],
      kickers: [onlyPair.value, ...kickers.map((c) => getRankValue(c.rank))],
      description: `${HAND_DESCRIPTIONS["one-pair"]} (${onlyPair.rank})`,
    };
  }

  // High card
  const highCards = [...cards]
    .sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank))
    .slice(0, 5);

  return {
    rank: "high-card",
    rankValue: HAND_RANK_VALUES["high-card"],
    cards: highCards,
    kickers: highCards.map((c) => getRankValue(c.rank)),
    description: `${HAND_DESCRIPTIONS["high-card"]} (${highCards[0]!.rank})`,
  };
}

/**
 * Compare two hand results. Returns:
 * - Positive number if hand1 wins
 * - Negative number if hand2 wins
 * - 0 if tie
 */
export function compareHands(hand1: HandResult, hand2: HandResult): number {
  // Compare hand rank first
  if (hand1.rankValue !== hand2.rankValue) {
    return hand1.rankValue - hand2.rankValue;
  }

  // Compare kickers
  for (
    let i = 0;
    i < Math.min(hand1.kickers.length, hand2.kickers.length);
    i++
  ) {
    const k1 = hand1.kickers[i] ?? 0;
    const k2 = hand2.kickers[i] ?? 0;
    if (k1 !== k2) {
      return k1 - k2;
    }
  }

  return 0; // Exact tie
}

/**
 * Find the best hand(s) from a list of players with their cards
 */
export function findWinners(
  playerHands: Array<{
    playerId: string;
    cards: Card[];
    communityCards: Card[];
  }>
): Array<{ playerId: string; hand: HandResult }> {
  const results = playerHands.map(({ playerId, cards, communityCards }) => ({
    playerId,
    hand: evaluateHand([...cards, ...communityCards]),
  }));

  // Sort by hand strength (descending)
  results.sort((a, b) => compareHands(b.hand, a.hand));

  // Find all players with the best hand (could be ties)
  const best = results[0];
  if (!best) return [];
  const bestHand = best.hand;
  const winners = results.filter((r) => compareHands(r.hand, bestHand) === 0);

  return winners;
}
