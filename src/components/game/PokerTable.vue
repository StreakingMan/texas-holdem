<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Player, Card as CardType, WinnerInfo, PlayerAction, GamePhase } from '@/core/types'
import PlayerSeat, { type BubbleMessage } from './PlayerSeat.vue'
import Card from './Card.vue'
import PotDisplay, { type LastActionInfo as PotLastActionInfo } from './PotDisplay.vue'
import { Coins } from 'lucide-vue-next'

export interface LastActionInfo {
  playerId: string
  action: PlayerAction
  amount?: number
}

export interface TipEffect {
  fromPlayerId: string
  toPlayerId: string
  amount: number
  timestamp: number
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
  isHost?: boolean
  tipEffects?: TipEffect[]
  // 回合计时相关
  turnStartTime?: number
  turnTimeLimit?: number
  hasUsedExtension?: boolean
}>()

const emit = defineEmits<{
  tip: [playerId: string, amount: number]
  openHandRankings: []
  requestExtension: []
  kickPlayer: [playerId: string]
}>()

// Local player chips for tip validation
const localPlayerChips = computed(() => {
  const localPlayer = props.players.find(p => p.id === props.localPlayerId)
  return localPlayer?.chips ?? 0
})

function handleTip(playerId: string, amount: number) {
  emit('tip', playerId, amount)
}

// Responsive breakpoint detection
const isMobile = ref(false)
const MOBILE_BREAKPOINT = 768

function checkMobile() {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// Desktop seat positions (horizontal ellipse layout)
const desktopSeatPositions = [
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

// Mobile seat positions (vertical layout)
// Bottom: 1 (self), Left: 3 (moved up), Top: 2, Right: 3 (moved up)
const mobileSeatPositions = [
  { x: 50, y: 92 },   // Seat 0 - Bottom center (self)
  { x: 12, y: 62 },   // Seat 1 - Left bottom (moved up)
  { x: 8,  y: 40 },   // Seat 2 - Left middle (moved up)
  { x: 12, y: 18 },   // Seat 3 - Left top (moved up)
  { x: 30, y: 6 },    // Seat 4 - Top left
  { x: 70, y: 6 },    // Seat 5 - Top right
  { x: 88, y: 18 },   // Seat 6 - Right top (moved up)
  { x: 92, y: 40 },   // Seat 7 - Right middle (moved up)
  { x: 88, y: 62 },   // Seat 8 - Right bottom (moved up)
]

// Use computed to switch between layouts
const seatPositions = computed(() => 
  isMobile.value ? mobileSeatPositions : desktopSeatPositions
)

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
  return seatPositions.value[index] || { x: 50, y: 50 }
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

// Format last action for PotDisplay
const potLastAction = computed((): PotLastActionInfo | null => {
  if (!props.lastAction) return null
  const player = props.players.find(p => p.id === props.lastAction!.playerId)
  return {
    playerId: props.lastAction.playerId,
    playerName: player?.name || '玩家',
    action: props.lastAction.action,
    amount: props.lastAction.amount
  }
})

// Get tip effect for a player (sending or receiving)
function getPlayerTipEffect(playerId: string): { type: 'sending' | 'receiving', amount: number } | null {
  if (!props.tipEffects || props.tipEffects.length === 0) return null
  
  // Check if this player is sending a tip
  const sendingEffect = props.tipEffects.find(e => e.fromPlayerId === playerId)
  if (sendingEffect) {
    return { type: 'sending', amount: sendingEffect.amount }
  }
  
  // Check if this player is receiving a tip
  const receivingEffect = props.tipEffects.find(e => e.toPlayerId === playerId)
  if (receivingEffect) {
    return { type: 'receiving', amount: receivingEffect.amount }
  }
  
  return null
}

// Get player display index by ID
function getPlayerDisplayIndex(playerId: string): number {
  return orderedPlayers.value.findIndex(p => p?.id === playerId)
}

// Calculate flying tip animations with positions
const flyingTips = computed(() => {
  if (!props.tipEffects || props.tipEffects.length === 0) return []
  
  const positions = seatPositions.value
  
  return props.tipEffects.map(effect => {
    const fromIndex = getPlayerDisplayIndex(effect.fromPlayerId)
    const toIndex = getPlayerDisplayIndex(effect.toPlayerId)
    
    if (fromIndex === -1 || toIndex === -1) return null
    
    const fromPos = positions[fromIndex]
    const toPos = positions[toIndex]
    
    if (!fromPos || !toPos) return null
    
    return {
      ...effect,
      fromX: fromPos.x,
      fromY: fromPos.y,
      toX: toPos.x,
      toY: toPos.y,
    }
  }).filter((tip): tip is NonNullable<typeof tip> => tip !== null)
})
</script>

<template>
  <div class="relative w-full h-full flex flex-col items-center px-2 sm:px-4 md:px-8 md:justify-center">
    <!-- Table background - Desktop (horizontal) -->
    <div 
      v-if="!isMobile"
      class="relative w-full max-w-5xl aspect-16/10 felt-texture rounded-[60px] md:rounded-[100px] border-6 md:border-8 border-amber-900/80 shadow-2xl"
    >
      <!-- Table inner border -->
      <div class="absolute inset-3 md:inset-4 rounded-[50px] md:rounded-[80px] border-3 md:border-4 border-amber-700/30"></div>

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
        :tip-effect="player ? getPlayerTipEffect(player.id) : null"
        :turn-start-time="player?.isTurn ? turnStartTime : undefined"
        :turn-time-limit="player?.isTurn ? turnTimeLimit : undefined"
        :has-used-extension="player?.isTurn ? hasUsedExtension : false"
        :is-host="isHost"
        @tip="handleTip"
        @open-hand-rankings="emit('openHandRankings')"
        @request-extension="emit('requestExtension')"
        @kick-player="(playerId) => emit('kickPlayer', playerId)"
      />

      <!-- Flying tip coins animation -->
      <TransitionGroup name="tip-fly">
        <div
          v-for="(tip, index) in flyingTips"
          :key="`tip-${tip.fromPlayerId}-${tip.toPlayerId}-${index}`"
          class="absolute inset-0 pointer-events-none z-[100]"
          :style="{
            '--from-x': `${tip.fromX}%`,
            '--from-y': `${tip.fromY}%`,
            '--to-x': `${tip.toX}%`,
            '--to-y': `${tip.toY}%`,
          }"
        >
          <!-- Multiple coins for effect -->
          <div 
            v-for="i in 5" 
            :key="i" 
            class="flying-coin"
            :style="{ '--delay': `${i * 80}ms`, '--offset': `${(i - 3) * 8}px` }"
          >
            <Coins class="w-6 h-6 text-amber-400 drop-shadow-lg" />
          </div>
          <!-- Amount label -->
          <div class="tip-amount-label">
            +${{ tip.amount }}
          </div>
        </div>
      </TransitionGroup>

      <!-- Center area (pot + community cards) - Desktop offset -->
      <div 
        class="absolute left-1/2 top-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3 md:gap-4 z-0"
        style="margin-top: -150px;"
      >
        <!-- Pot display with game status -->
        <PotDisplay 
          :amount="pot" 
          :phase="phase"
          :current-player-id="currentPlayerId"
          :players="players"
          :winners="winners"
          :last-action="potLastAction"
          :is-host="isHost"
        />

        <!-- Community cards (always show 5 slots) -->
        <div 
          v-if="phase !== 'waiting'"
          class="flex gap-1.5 md:gap-2 p-2 md:p-3 bg-gray-900/40 backdrop-blur rounded-xl"
        >
          <template v-for="i in 5" :key="i">
            <!-- Show actual card if available -->
            <Card
              v-if="communityCards[i - 1]"
              :card="communityCards[i - 1] ?? null"
              size="md"
              :animation-delay="(i - 1) * 150"
              class="deal-animation"
            />
            <!-- Show placeholder for empty slots - responsive size -->
            <div 
              v-else
              class="card-placeholder rounded-lg border-2 border-dashed border-gray-600/50"
            ></div>
          </template>
        </div>
      </div>
    </div>

    <!-- Table background - Mobile (vertical, fill height but leave space for action panel) -->
    <div 
      v-else
      class="relative w-full flex-1 min-h-0 max-h-[calc(100%-80px)] my-1 felt-texture rounded-[30px] border-4 border-amber-900/80 shadow-2xl"
    >
      <!-- Table inner border -->
      <div class="absolute inset-2 rounded-[22px] border-2 border-amber-700/30"></div>

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
        :tip-effect="player ? getPlayerTipEffect(player.id) : null"
        :turn-start-time="player?.isTurn ? turnStartTime : undefined"
        :turn-time-limit="player?.isTurn ? turnTimeLimit : undefined"
        :has-used-extension="player?.isTurn ? hasUsedExtension : false"
        :is-host="isHost"
        @tip="handleTip"
        @open-hand-rankings="emit('openHandRankings')"
        @request-extension="emit('requestExtension')"
        @kick-player="(playerId) => emit('kickPlayer', playerId)"
      />

      <!-- Flying tip coins animation -->
      <TransitionGroup name="tip-fly">
        <div
          v-for="(tip, index) in flyingTips"
          :key="`tip-${tip.fromPlayerId}-${tip.toPlayerId}-${index}`"
          class="absolute inset-0 pointer-events-none z-[100]"
          :style="{
            '--from-x': `${tip.fromX}%`,
            '--from-y': `${tip.fromY}%`,
            '--to-x': `${tip.toX}%`,
            '--to-y': `${tip.toY}%`,
          }"
        >
          <!-- Multiple coins for effect -->
          <div 
            v-for="i in 5" 
            :key="i" 
            class="flying-coin"
            :style="{ '--delay': `${i * 80}ms`, '--offset': `${(i - 3) * 8}px` }"
          >
            <Coins class="w-5 h-5 text-amber-400 drop-shadow-lg" />
          </div>
          <!-- Amount label -->
          <div class="tip-amount-label text-xs">
            +${{ tip.amount }}
          </div>
        </div>
      </TransitionGroup>

      <!-- Center area (pot + community cards) - Mobile centered -->
      <div 
        class="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-0"
      >
        <!-- Pot display with game status -->
        <PotDisplay 
          :amount="pot" 
          :phase="phase"
          :current-player-id="currentPlayerId"
          :players="players"
          :winners="winners"
          :last-action="potLastAction"
          :is-host="isHost"
        />

        <!-- Community cards (always show 5 slots) - Mobile uses smaller cards -->
        <div 
          v-if="phase !== 'waiting'"
          class="flex gap-1 p-1.5 bg-gray-900/40 backdrop-blur rounded-lg"
        >
          <template v-for="i in 5" :key="i">
            <!-- Show actual card if available -->
            <Card
              v-if="communityCards[i - 1]"
              :card="communityCards[i - 1] ?? null"
              size="sm"
              :animation-delay="(i - 1) * 150"
              class="deal-animation"
            />
            <!-- Show placeholder for empty slots -->
            <div 
              v-else
              class="card-placeholder-sm rounded border-2 border-dashed border-gray-600/50"
            ></div>
          </template>
        </div>
      </div>
    </div>
    
    <!-- Slot for action panel below table -->
    <div 
      class="shrink-0 mt-2 md:mt-12 relative z-50 w-full max-w-md mx-auto px-2 md:px-0"
      style="padding-bottom: var(--safe-area-bottom, 0px);"
    >
      <slot name="action-panel"></slot>
    </div>
  </div>
</template>

<style scoped>
/* Desktop card placeholder */
.card-placeholder {
  width: var(--card-width-md, 56px);
  height: var(--card-height-md, 80px);
}

/* Mobile card placeholder (smaller) - matches card-sm */
.card-placeholder-sm {
  width: var(--card-width-sm, 40px);
  height: var(--card-height-sm, 56px);
}

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

/* ========== Flying Tip Coins Animation ========== */
.tip-fly-enter-active,
.tip-fly-leave-active {
  transition: opacity 0.3s ease;
}

.tip-fly-enter-from,
.tip-fly-leave-to {
  opacity: 0;
}

.flying-coin {
  position: absolute;
  left: var(--from-x);
  top: var(--from-y);
  transform: translate(-50%, -50%);
  animation: fly-to-target 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: var(--delay);
  opacity: 0;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.6));
}

@keyframes fly-to-target {
  0% {
    left: var(--from-x);
    top: var(--from-y);
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2) rotate(15deg);
  }
  50% {
    /* Arc motion - go up in the middle */
    left: calc((var(--from-x) + var(--to-x)) / 2);
    top: calc((var(--from-y) + var(--to-y)) / 2 - 15%);
    transform: translate(calc(-50% + var(--offset)), -50%) scale(1) rotate(180deg);
  }
  85% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2) rotate(345deg);
  }
  100% {
    left: var(--to-x);
    top: var(--to-y);
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8) rotate(360deg);
  }
}

.tip-amount-label {
  position: absolute;
  left: var(--from-x);
  top: var(--from-y);
  transform: translate(-50%, -50%);
  animation: fly-amount-label 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: 0.2s;
  opacity: 0;
  font-size: 14px;
  font-weight: bold;
  color: #fbbf24;
  text-shadow: 0 0 8px rgba(251, 191, 36, 0.8), 0 2px 4px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  pointer-events: none;
}

@keyframes fly-amount-label {
  0% {
    left: var(--from-x);
    top: var(--from-y);
    opacity: 0;
    transform: translate(-50%, -80%) scale(0.8);
  }
  20% {
    opacity: 1;
    transform: translate(-50%, -120%) scale(1.2);
  }
  50% {
    left: calc((var(--from-x) + var(--to-x)) / 2);
    top: calc((var(--from-y) + var(--to-y)) / 2 - 20%);
    transform: translate(-50%, -100%) scale(1.1);
  }
  80% {
    opacity: 1;
  }
  100% {
    left: var(--to-x);
    top: var(--to-y);
    opacity: 0;
    transform: translate(-50%, -80%) scale(1);
  }
}
</style>

