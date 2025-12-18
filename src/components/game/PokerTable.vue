<script setup lang="ts">
import { computed } from 'vue'
import type { Player, Card as CardType, WinnerInfo, PlayerAction, GamePhase } from '@/core/types'
import PlayerSeat, { type BubbleMessage } from './PlayerSeat.vue'
import Card from './Card.vue'
import PotDisplay from './PotDisplay.vue'

export interface LastActionInfo {
  playerId: string
  action: PlayerAction
}

const props = defineProps<{
  players: Player[]
  communityCards: CardType[]
  pot: number
  phase: GamePhase
  currentPlayerId?: string
  winners?: WinnerInfo[]
  localPlayerId: string
  playerBubbles?: Map<string, BubbleMessage>
  lastAction?: LastActionInfo | null
}>()

const emit = defineEmits<{
  tip: [playerId: string, amount: number]
  openHandRankings: []
}>()

// Local player chips for tip validation
const localPlayerChips = computed(() => {
  const localPlayer = props.players.find(p => p.id === props.localPlayerId)
  return localPlayer?.chips ?? 0
})

function handleTip(playerId: string, amount: number) {
  emit('tip', playerId, amount)
}

// Calculate seat positions around the table
// Layout: 4 corners + bottom center (self) + left/right middle + top 2
const seatPositions = [
  { x: 50, y: 92 },   // Seat 0 - Bottom center (self)
  { x: 12, y: 78 },   // Seat 1 - Bottom left corner
  { x: 3,  y: 45 },   // Seat 2 - Left middle
  { x: 12, y: 12 },   // Seat 3 - Top left corner
  { x: 38, y: 3 },    // Seat 4 - Top left
  { x: 62, y: 3 },    // Seat 5 - Top right
  { x: 88, y: 12 },   // Seat 6 - Top right corner
  { x: 97, y: 45 },   // Seat 7 - Right middle
  { x: 88, y: 78 },   // Seat 8 - Bottom right corner
]

// Reorder players so local player is at position 0
const orderedPlayers = computed(() => {
  const result: (Player | null)[] = new Array(9).fill(null)
  
  // Find local player's seat index
  const localPlayer = props.players.find(p => p.id === props.localPlayerId)
  const localSeatIndex = localPlayer?.seatIndex ?? 0
  
  // Map each player to rotated position
  for (const player of props.players) {
    // Calculate rotated position so local player is always at bottom
    let displayIndex = (player.seatIndex - localSeatIndex + 9) % 9
    result[displayIndex] = player
  }
  
  return result
})

// Check if a player is a winner
function isWinner(playerId: string): boolean {
  return props.winners?.some(w => w.playerId === playerId) ?? false
}

// Get win amount for a player
function getWinAmount(playerId: string): number | undefined {
  return props.winners?.find(w => w.playerId === playerId)?.amount
}

// Get display position for a seat
function getPosition(index: number): { x: number; y: number } {
  return seatPositions[index] || { x: 50, y: 50 }
}

// Show cards in showdown
const showAllCards = computed(() => 
  props.phase === 'showdown' || props.phase === 'ended'
)

// Get bubble message for a player
function getPlayerBubble(playerId: string): BubbleMessage | null {
  return props.playerBubbles?.get(playerId) || null
}

// Get last action for a player (only if it's the current lastAction)
function getPlayerLastAction(playerId: string): PlayerAction | null {
  if (props.lastAction && props.lastAction.playerId === playerId) {
    return props.lastAction.action
  }
  return null
}
</script>

<template>
  <div class="relative w-full h-full flex items-center justify-center px-8 pb-20">
    <!-- Table background -->
    <div 
      class="relative w-full max-w-5xl aspect-16/10 felt-texture rounded-[100px] border-8 border-amber-900/80 shadow-2xl"
    >
      <!-- Table inner border -->
      <div class="absolute inset-4 rounded-[80px] border-4 border-amber-700/30"></div>

      <!-- Player seats -->
      <PlayerSeat
        v-for="(player, index) in orderedPlayers"
        :key="index"
        :player="player"
        :position="getPosition(index)"
        :is-local="player?.id === localPlayerId"
        :show-cards="showAllCards"
        :is-winner="player ? isWinner(player.id) : false"
        :win-amount="player ? getWinAmount(player.id) : undefined"
        :latest-message="player ? getPlayerBubble(player.id) : null"
        :last-action="player ? getPlayerLastAction(player.id) : null"
        :local-player-chips="localPlayerChips"
        :community-cards="communityCards"
        :phase="phase"
        @tip="handleTip"
        @open-hand-rankings="emit('openHandRankings')"
      />

      <!-- Center area (pot + community cards) -->
      <div 
        class="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-0"
      >
        <!-- Pot display -->
        <PotDisplay :amount="pot" :phase="phase" />

        <!-- Community cards -->
        <div 
          v-if="communityCards.length > 0"
          class="flex gap-2 p-3 bg-gray-900/40 backdrop-blur rounded-xl"
        >
          <Card
            v-for="(card, i) in communityCards"
            :key="i"
            :card="card"
            size="md"
            :animation-delay="i * 150"
            class="deal-animation"
          />
        </div>

        <!-- Waiting for cards placeholder -->
        <div 
          v-else-if="phase !== 'waiting' && phase !== 'preflop'"
          class="flex gap-2 p-3 bg-gray-900/40 backdrop-blur rounded-xl"
        >
          <div 
            v-for="i in 5" 
            :key="i"
            class="w-14 h-20 rounded-lg border-2 border-dashed border-gray-600/50"
          ></div>
        </div>

        <!-- Winner hand description -->
        <div 
          v-if="winners && winners.length > 0 && winners[0]?.hand?.description"
          class="bg-gray-900/80 backdrop-blur px-4 py-2 rounded-lg border border-amber-500/30"
        >
          <div class="text-amber-400 text-sm font-medium text-center">
            {{ winners[0]?.hand?.description }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes deal {
  0% {
    transform: translateY(-50px) rotateY(180deg);
    opacity: 0;
  }
  100% {
    transform: translateY(0) rotateY(0);
    opacity: 1;
  }
}

.deal-animation {
  animation: deal 0.4s ease-out backwards;
}
</style>

