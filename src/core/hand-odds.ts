/**
 * Hand odds and drawing probability calculator
 */
import type { Card, GamePhase, HandRank, Suit } from "./types";
import { evaluateHand } from "./hand-evaluator";
import { getRankValue } from "./deck";

export interface HandSuggestion {
  type: "made" | "draw"; // 已成牌 or 听牌
  name: string; // 如 "两对"、"同花听牌"
  probability: number; // 概率百分比 (0-100)
  outs?: number; // 听牌的 outs 数
  icon: string; // 图标标识
  tip: string; // 新手向解释
}

// Hand rank to display rank mapping (1-10, higher rank = stronger hand)
const HAND_RANK_TO_DISPLAY: Record<HandRank, number> = {
  "royal-flush": 1,
  "straight-flush": 2,
  "four-of-a-kind": 3,
  "full-house": 4,
  flush: 5,
  straight: 6,
  "three-of-a-kind": 7,
  "two-pair": 8,
  "one-pair": 9,
  "high-card": 10,
};

const HAND_RANK_NAMES: Record<HandRank, string> = {
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
 * Calculate outs to probability using 2-4 rule
 * @param outs Number of outs
 * @param cardsTocome Number of cards still to come (1 for turn->river, 2 for flop->river)
 */
function outsToPercent(outs: number, cardsToCome: number): number {
  if (cardsToCome === 2) {
    // Flop to river: multiply by ~4
    return Math.min(outs * 4, 100);
  } else {
    // Turn to river: multiply by ~2
    return Math.min(outs * 2.2, 100);
  }
}

/**
 * Count cards of each suit
 */
function countSuits(cards: Card[]): Map<Suit, number> {
  const counts = new Map<Suit, number>();
  for (const card of cards) {
    counts.set(card.suit, (counts.get(card.suit) || 0) + 1);
  }
  return counts;
}

/**
 * Get rank values sorted
 */
function getSortedRankValues(cards: Card[]): number[] {
  return cards.map((c) => getRankValue(c.rank)).sort((a, b) => b - a);
}

/**
 * Check for flush draw (4 cards of same suit)
 */
function getFlushDraw(cards: Card[]): { outs: number; suit: Suit } | null {
  const suitCounts = countSuits(cards);
  for (const [suit, count] of suitCounts) {
    if (count === 4) {
      return { outs: 9, suit }; // 9 remaining cards of that suit
    }
  }
  return null;
}

/**
 * Check for backdoor flush draw (3 cards of same suit, only on flop)
 */
function getBackdoorFlushDraw(
  cards: Card[],
  phase: GamePhase
): { outs: number } | null {
  if (phase !== "flop") return null;
  const suitCounts = countSuits(cards);
  for (const [, count] of suitCounts) {
    if (count === 3) {
      return { outs: 2 }; // Rough estimate for backdoor
    }
  }
  return null;
}

/**
 * Check for straight draws
 */
function getStraightDraw(
  cards: Card[]
): { type: "oesd" | "gutshot"; outs: number } | null {
  const values = [...new Set(getSortedRankValues(cards))].sort((a, b) => a - b);

  // Check for open-ended straight draw (8 outs)
  for (let i = 0; i <= values.length - 4; i++) {
    const slice = values.slice(i, i + 4);
    if (slice.length === 4) {
      const v0 = slice[0]!;
      const v1 = slice[1]!;
      const v2 = slice[2]!;
      const v3 = slice[3]!;
      if (v1 - v0 === 1 && v2 - v1 === 1 && v3 - v2 === 1) {
        // 4 consecutive cards - open-ended
        // Check if not at the edges (2-3-4-5 or 10-J-Q-K-A)
        if (v0 > 2 && v3 < 14) {
          return { type: "oesd", outs: 8 };
        }
        // Edge case - still a gutshot at minimum
        return { type: "gutshot", outs: 4 };
      }
    }
  }

  // Check for gutshot (4 outs) - one gap in 4 cards
  for (let i = 0; i <= values.length - 4; i++) {
    const slice = values.slice(i, i + 4);
    if (slice.length === 4) {
      const v0 = slice[0]!;
      const v3 = slice[3]!;
      // If span is 4 (e.g., 5-6-8-9 spans 4), it's a gutshot
      if (v3 - v0 === 4) {
        const gaps = [];
        for (let j = 0; j < 3; j++) {
          const curr = slice[j]!;
          const next = slice[j + 1]!;
          if (next - curr === 2) gaps.push(curr + 1);
        }
        if (gaps.length === 1) {
          return { type: "gutshot", outs: 4 };
        }
      }
    }
  }

  // Check for A-2-3-4 or similar wheel draws
  if (values.includes(14)) {
    const lowValues = values.filter((v) => v <= 5 || v === 14);
    const wheelParts = [14, 2, 3, 4, 5].filter((v) =>
      lowValues.includes(v === 14 ? 14 : v)
    );
    if (wheelParts.length === 4) {
      return { type: "oesd", outs: 4 }; // A-2-3-4 or 2-3-4-5 with A
    }
  }

  return null;
}

/**
 * Check for backdoor straight draw
 */
function getBackdoorStraightDraw(
  cards: Card[],
  phase: GamePhase
): { outs: number } | null {
  if (phase !== "flop") return null;
  const values = [...new Set(getSortedRankValues(cards))].sort((a, b) => a - b);

  // Check for 3 cards within 4 ranks
  for (let i = 0; i <= values.length - 3; i++) {
    const slice = values.slice(i, i + 3);
    if (slice.length === 3) {
      const v0 = slice[0]!;
      const v2 = slice[2]!;
      if (v2 - v0 <= 4) {
        return { outs: 2 }; // Rough estimate
      }
    }
  }
  return null;
}

/**
 * Get cards to come based on phase
 */
function getCardsToCome(phase: GamePhase): number {
  switch (phase) {
    case "preflop":
      return 5;
    case "flop":
      return 2;
    case "turn":
      return 1;
    default:
      return 0;
  }
}

// Tips for made hands - explain what the hand is
const MADE_HAND_TIPS: Record<HandRank, string> = {
  "royal-flush": "A到10同花色，最强牌型",
  "straight-flush": "五张连续同花色",
  "four-of-a-kind": "四张相同点数",
  "full-house": "三张同点+一对",
  flush: "五张同花色",
  straight: "五张连续点数",
  "three-of-a-kind": "三张相同点数",
  "two-pair": "两组相同点数的牌",
  "one-pair": "两张相同点数",
  "high-card": "无任何组合",
};

/**
 * Get current made hand info
 */
function getMadeHandInfo(
  holeCards: Card[],
  communityCards: Card[]
): HandSuggestion | null {
  if (communityCards.length === 0) return null;

  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) return null;

  try {
    const result = evaluateHand(allCards);
    return {
      type: "made",
      name: HAND_RANK_NAMES[result.rank],
      probability: 100,
      icon: "check",
      tip: MADE_HAND_TIPS[result.rank],
    };
  } catch {
    return null;
  }
}

/**
 * Analyze hand and return top 3 suggestions sorted by probability
 */
export function analyzeHand(
  holeCards: Card[],
  communityCards: Card[],
  phase: GamePhase
): HandSuggestion[] {
  const suggestions: HandSuggestion[] = [];

  // No analysis before flop or after showdown
  if (
    phase === "waiting" ||
    phase === "preflop" ||
    phase === "showdown" ||
    phase === "ended"
  ) {
    return suggestions;
  }

  if (holeCards.length < 2) return suggestions;

  const allCards = [...holeCards, ...communityCards];
  const cardsToCome = getCardsToCome(phase);

  // 1. Get current made hand
  const madeHand = getMadeHandInfo(holeCards, communityCards);
  if (madeHand) {
    suggestions.push(madeHand);
  }

  // 2. Check for flush draw
  const flushDraw = getFlushDraw(allCards);
  if (flushDraw && cardsToCome > 0) {
    // Don't show if already have flush
    if (!madeHand || madeHand.name !== "同花") {
      const prob = Math.round(outsToPercent(flushDraw.outs, cardsToCome));
      suggestions.push({
        type: "draw",
        name: "同花听牌",
        probability: prob,
        outs: flushDraw.outs,
        icon: "droplet",
        tip: "已有4张同花色，差1张成同花",
      });
    }
  }

  // 3. Check for straight draw
  const straightDraw = getStraightDraw(allCards);
  if (straightDraw && cardsToCome > 0) {
    // Don't show if already have straight or better
    if (
      !madeHand ||
      (madeHand.name !== "顺子" &&
        madeHand.name !== "同花" &&
        madeHand.name !== "葫芦" &&
        madeHand.name !== "四条" &&
        madeHand.name !== "同花顺" &&
        madeHand.name !== "皇家同花顺")
    ) {
      const isOesd = straightDraw.type === "oesd";
      const name = isOesd ? "两头顺听" : "卡张顺听";
      const prob = Math.round(outsToPercent(straightDraw.outs, cardsToCome));
      suggestions.push({
        type: "draw",
        name,
        probability: prob,
        outs: straightDraw.outs,
        icon: "link",
        tip: isOesd ? "如5678，差4或9成顺" : "如5679，只差8成顺",
      });
    }
  }

  // 4. Check for backdoor draws (only on flop)
  if (phase === "flop") {
    const backdoorFlush = getBackdoorFlushDraw(allCards, phase);
    if (backdoorFlush && !flushDraw) {
      suggestions.push({
        type: "draw",
        name: "后门同花",
        probability: 4,
        outs: backdoorFlush.outs,
        icon: "droplets",
        tip: "有3张同花色，需再来2张",
      });
    }

    const backdoorStraight = getBackdoorStraightDraw(allCards, phase);
    if (backdoorStraight && !straightDraw) {
      suggestions.push({
        type: "draw",
        name: "后门顺子",
        probability: 4,
        outs: backdoorStraight.outs,
        icon: "links",
        tip: "有3张接近连续，需再来2张",
      });
    }
  }

  // Sort by probability (descending) and take top 3
  suggestions.sort((a, b) => b.probability - a.probability);
  return suggestions.slice(0, 3);
}

/**
 * Get current hand rank for highlighting in HelpModal
 * Returns display rank (1-10) or null if no community cards
 */
export function getCurrentHandRank(
  holeCards: Card[],
  communityCards: Card[]
): number | null {
  if (holeCards.length < 2 || communityCards.length === 0) return null;

  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) return null;

  try {
    const result = evaluateHand(allCards);
    return HAND_RANK_TO_DISPLAY[result.rank];
  } catch {
    return null;
  }
}

// Tips for starting hand tiers - explain tier meaning
const TIER_TIPS: Record<string, string> = {
  S: "最强起手牌，如AA/KK/AK",
  A: "优质起手牌，如QQ/JJ/AQ",
  B: "中等牌，同花连牌等",
  C: "投机牌，小对子等",
  D: "弱牌，不成对不连续",
};

/**
 * Analyze starting hand (preflop only)
 */
export function analyzeStartingHand(
  holeCards: Card[]
): { tier: string; name: string; tip: string } | null {
  if (holeCards.length < 2) return null;

  const [card1, card2] = holeCards;
  if (!card1 || !card2) return null;

  const ranks = [
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
  const rank1 = ranks.indexOf(card1.rank);
  const rank2 = ranks.indexOf(card2.rank);
  const highRank = Math.max(rank1, rank2);
  const lowRank = Math.min(rank1, rank2);
  const gap = highRank - lowRank;
  const isPair = card1.rank === card2.rank;
  const isSuited = card1.suit === card2.suit;

  let tier = "D";
  let name = "弱牌";

  if (isPair) {
    if (highRank >= 12) {
      tier = "S";
      name = "顶级对子";
    } else if (highRank >= 9) {
      tier = "A";
      name = "高对子";
    } else if (highRank >= 6) {
      tier = "B";
      name = "中对子";
    } else {
      tier = "C";
      name = "小对子";
    }
  } else {
    const hasAce = highRank === 12;
    const hasKing = highRank === 11;
    const isConnected = gap <= 2;

    if (hasAce && lowRank >= 11) {
      tier = "S";
      name = "AK大牌";
    } else if (hasAce && lowRank >= 9) {
      tier = isSuited ? "A" : "B";
      name = "A高牌";
    } else if (hasKing && lowRank >= 9) {
      tier = isSuited ? "B" : "C";
      name = "K高牌";
    } else if (isSuited && isConnected && lowRank >= 5) {
      tier = "B";
      name = "同花连牌";
    } else if (isSuited && hasAce) {
      tier = "C";
      name = "同花A";
    } else if (isConnected && lowRank >= 7) {
      tier = "C";
      name = "连牌";
    }
  }

  return { tier, name, tip: TIER_TIPS[tier] || "弱牌，建议弃牌" };
}
