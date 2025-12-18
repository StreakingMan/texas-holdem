<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import type { Player, PlayerAction } from '@/core/types'
import Card from './Card.vue'
import ChipStack from './ChipStack.vue'
import { Crown, Timer, Wifi, WifiOff, Gift, X } from 'lucide-vue-next'
import { getAvatarById } from '@/utils/avatars'

// Chat bubble message type
export interface BubbleMessage {
  content: string
  timestamp: number
}

const props = defineProps<{
  player: Player | null
  position: { x: number; y: number }
  isLocal?: boolean
  showCards?: boolean
  isWinner?: boolean
  winAmount?: number
  latestMessage?: BubbleMessage | null
  lastAction?: PlayerAction | null
  localPlayerChips?: number
}>()

const emit = defineEmits<{
  tip: [playerId: string, amount: number]
}>()

// Bubble visibility state
const showBubble = ref(false)
const bubbleContent = ref('')
let bubbleTimer: ReturnType<typeof setTimeout> | null = null

// Action effect state
const showRaiseEffect = ref(false)
const showAllInEffect = ref(false)
let actionEffectTimer: ReturnType<typeof setTimeout> | null = null

// Tip state
const showTipPopover = ref(false)
const customTipAmount = ref(50)
const tipPresets = [10, 50, 100, 200]

function toggleTipPopover() {
  showTipPopover.value = !showTipPopover.value
}

function sendTip(amount: number) {
  if (props.player && amount > 0 && (props.localPlayerChips ?? 0) >= amount) {
    emit('tip', props.player.id, amount)
    showTipPopover.value = false
  }
}

// Can afford tip check
const canAffordTip = (amount: number) => (props.localPlayerChips ?? 0) >= amount

// Watch for new messages
watch(
  () => props.latestMessage,
  (newMsg) => {
    if (newMsg && newMsg.content) {
      // Clear existing timer
      if (bubbleTimer) {
        clearTimeout(bubbleTimer)
      }
      
      // Show bubble
      bubbleContent.value = newMsg.content
      showBubble.value = true
      
      // Hide after 3 seconds
      bubbleTimer = setTimeout(() => {
        showBubble.value = false
      }, 3000)
    }
  },
  { immediate: true }
)

// Watch for action effects
watch(
  () => props.lastAction,
  (action) => {
    if (!action) return
    
    // Clear existing effect timer
    if (actionEffectTimer) {
      clearTimeout(actionEffectTimer)
      showRaiseEffect.value = false
      showAllInEffect.value = false
    }
    
    if (action === 'raise') {
      showRaiseEffect.value = true
      actionEffectTimer = setTimeout(() => {
        showRaiseEffect.value = false
      }, 2000)
    } else if (action === 'all-in') {
      showAllInEffect.value = true
      actionEffectTimer = setTimeout(() => {
        showAllInEffect.value = false
      }, 3000)
    }
  }
)

// Cleanup timer on unmount
onUnmounted(() => {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer)
  }
  if (actionEffectTimer) {
    clearTimeout(actionEffectTimer)
  }
})

// Position styles
const positionStyle = computed(() => ({
  left: `${props.position.x}%`,
  top: `${props.position.y}%`,
  transform: 'translate(-50%, -50%)'
}))

// Card display logic
const displayCards = computed(() => {
  if (!props.player) return []
  if (props.showCards || props.isLocal) {
    return props.player.cards
  }
  // Show face-down cards for other players
  return props.player.cards.map(() => null)
})

// Status indicator
const statusClass = computed(() => {
  if (!props.player) return ''
  if (props.player.folded) return 'opacity-50 grayscale'
  return ''
})
</script>

<template>
  <div
    class="absolute flex flex-col items-center gap-2 transition-all duration-300 z-10"
    :class="statusClass"
    :style="positionStyle"
  >
    <!-- Empty seat -->
    <div 
      v-if="!player"
      class="w-20 h-20 rounded-full bg-gray-800/50 border-2 border-dashed border-gray-600 flex items-center justify-center"
    >
      <span class="text-gray-500 text-sm">空座</span>
    </div>

    <!-- Player seat -->
    <template v-else>
      <!-- Raise Effect -->
      <Transition name="effect-fade">
        <div 
          v-if="showRaiseEffect"
          class="absolute inset-0 -z-10 pointer-events-none flex items-center justify-center"
        >
          <!-- Rising coins animation -->
          <div class="raise-effect">
            <div class="raise-particle" style="--delay: 0s; --x: -20px"></div>
            <div class="raise-particle" style="--delay: 0.1s; --x: 0px"></div>
            <div class="raise-particle" style="--delay: 0.2s; --x: 20px"></div>
            <div class="raise-particle" style="--delay: 0.15s; --x: -10px"></div>
            <div class="raise-particle" style="--delay: 0.25s; --x: 10px"></div>
          </div>
          <!-- Glow ring -->
          <div class="absolute w-32 h-32 rounded-full border-2 border-amber-400/60 raise-ring"></div>
          <div class="absolute w-28 h-28 rounded-full bg-amber-500/20 blur-lg raise-glow"></div>
        </div>
      </Transition>

      <!-- All-in Effect -->
      <Transition name="effect-fade">
        <div 
          v-if="showAllInEffect"
          class="absolute inset-0 -z-10 pointer-events-none flex items-center justify-center overflow-visible"
        >
          <!-- Fire particles -->
          <div class="allin-effect">
            <div class="fire-particle" v-for="i in 12" :key="i" :style="`--i: ${i}`"></div>
          </div>
          <!-- Explosion rings -->
          <div class="absolute w-40 h-40 rounded-full border-4 border-red-500/80 allin-ring"></div>
          <div class="absolute w-36 h-36 rounded-full border-2 border-orange-400/60 allin-ring" style="animation-delay: 0.1s"></div>
          <div class="absolute w-32 h-32 rounded-full border-2 border-yellow-400/40 allin-ring" style="animation-delay: 0.2s"></div>
          <!-- Center glow -->
          <div class="absolute w-24 h-24 rounded-full bg-red-500/40 blur-xl allin-glow"></div>
          <div class="absolute w-20 h-20 rounded-full bg-orange-400/50 blur-lg allin-glow" style="animation-delay: 0.2s"></div>
        </div>
      </Transition>

      <!-- Winner Effect -->
      <Transition name="effect-fade">
        <div 
          v-if="isWinner"
          class="absolute inset-0 -z-10 pointer-events-none flex items-center justify-center overflow-visible"
        >
          <!-- Sparkle particles -->
          <div class="winner-sparkles">
            <div class="sparkle" v-for="i in 8" :key="i" :style="`--i: ${i}`">✨</div>
          </div>
          <!-- Golden rings -->
          <div class="absolute w-48 h-48 rounded-full border-4 border-amber-400/80 winner-ring"></div>
          <div class="absolute w-44 h-44 rounded-full border-2 border-yellow-300/60 winner-ring" style="animation-delay: 0.15s"></div>
          <!-- Crown glow -->
          <div class="absolute w-36 h-36 rounded-full bg-amber-400/30 blur-2xl winner-glow"></div>
          <div class="absolute w-28 h-28 rounded-full bg-yellow-300/40 blur-xl winner-glow"></div>
        </div>
      </Transition>

      <!-- Chat bubble -->
      <Transition name="bubble">
        <div 
          v-if="showBubble && bubbleContent"
          class="absolute z-20 bottom-full mb-2 left-0 right-0 flex justify-center pointer-events-none"
        >
          <div class="relative bg-white text-gray-800 px-3 py-1.5 rounded-xl shadow-lg max-w-[150px]">
            <p class="text-xs wrap-break-word line-clamp-2">{{ bubbleContent }}</p>
            <!-- Arrow pointing down -->
            <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-white"></div>
          </div>
        </div>
      </Transition>

      <!-- Cards (above avatar) -->
      <div class="flex gap-1 mb-1">
        <Card
          v-for="(card, i) in displayCards"
          :key="i"
          :card="card"
          :face-down="!card"
          :size="isLocal ? 'md' : 'sm'"
          :highlighted="isWinner"
          :animation-delay="i * 100"
        />
      </div>

      <!-- Avatar and info -->
      <div 
        class="relative bg-gray-800/90 rounded-xl p-2 min-w-[100px] backdrop-blur transition-all duration-300"
        :class="[
          player.isTurn 
            ? 'border-2 border-amber-400/80 shadow-lg shadow-amber-500/40' 
            : 'border border-gray-700/50',
          isWinner && 'border-2 border-emerald-400 shadow-lg shadow-emerald-500/40'
        ]"
      >
        <!-- Turn glow effect (behind the card) -->
        <div 
          v-if="player.isTurn"
          class="absolute inset-0 -z-10 pointer-events-none flex items-center justify-center overflow-visible"
        >
          <!-- Outer glow ring -->
          <div class="absolute w-40 h-40 rounded-full bg-amber-500/20 blur-xl glow-pulse"></div>
          <!-- Inner glow ring -->
          <div class="absolute w-32 h-32 rounded-full bg-amber-400/30 blur-lg glow-pulse-delay"></div>
          <!-- Spotlight effect -->
          <div class="absolute w-48 h-48 rounded-full bg-gradient-radial from-amber-500/10 via-transparent to-transparent"></div>
        </div>

        <!-- Dealer button -->
        <div 
          v-if="player.isDealer"
          class="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-xs font-bold text-gray-900 shadow-lg"
        >
          D
        </div>

        <!-- Blind indicators -->
        <div 
          v-if="player.isSmallBlind"
          class="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
        >
          SB
        </div>
        <div 
          v-if="player.isBigBlind"
          class="absolute -top-2 -left-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
        >
          BB
        </div>

        <!-- Connection status -->
        <div class="absolute -top-1 right-6">
          <Wifi v-if="player.isConnected" class="w-3 h-3 text-emerald-400" />
          <WifiOff v-else class="w-3 h-3 text-red-400" />
        </div>

        <!-- Tip button (for non-local players) -->
        <button
          v-if="!isLocal && player.isConnected"
          @click.stop="toggleTipPopover"
          class="absolute -bottom-3 -right-3 w-6 h-6 bg-pink-500 hover:bg-pink-400 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 z-20"
          title="打赏"
        >
          <Gift class="w-3 h-3" />
        </button>

        <!-- Tip popover -->
        <Transition name="tip-popover">
          <div
            v-if="showTipPopover && !isLocal"
            class="absolute -right-2 top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl z-30 min-w-[160px]"
            @click.stop
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-white text-sm font-medium">💰 打赏</span>
              <button @click="showTipPopover = false" class="text-gray-400 hover:text-white">
                <X class="w-4 h-4" />
              </button>
            </div>
            
            <!-- Preset amounts -->
            <div class="grid grid-cols-2 gap-2 mb-2">
              <button
                v-for="amount in tipPresets"
                :key="amount"
                @click="sendTip(amount)"
                :disabled="!canAffordTip(amount)"
                class="px-2 py-1 rounded text-sm font-medium transition-all"
                :class="canAffordTip(amount) 
                  ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 border border-pink-500/30' 
                  : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'"
              >
                ${{ amount }}
              </button>
            </div>
            
            <!-- Custom amount -->
            <div class="flex gap-2">
              <input
                v-model.number="customTipAmount"
                type="number"
                min="1"
                :max="localPlayerChips"
                class="flex-1 bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600 focus:border-pink-500 focus:outline-none w-16"
                placeholder="金额"
              />
              <button
                @click="sendTip(customTipAmount)"
                :disabled="!canAffordTip(customTipAmount) || customTipAmount <= 0"
                class="px-3 py-1 rounded text-sm font-medium transition-all"
                :class="canAffordTip(customTipAmount) && customTipAmount > 0
                  ? 'bg-pink-500 text-white hover:bg-pink-400' 
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
              >
                送
              </button>
            </div>
            
            <!-- Balance hint -->
            <p class="text-gray-500 text-xs mt-2 text-center">
              余额: ${{ (localPlayerChips ?? 0).toLocaleString() }}
            </p>
          </div>
        </Transition>

        <!-- Player avatar -->
        <div class="flex items-center gap-2">
          <div 
            class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center shrink-0"
          >
            <component 
              v-if="player.avatar && getAvatarById(player.avatar)"
              :is="getAvatarById(player.avatar)!.icon"
              class="w-6 h-6"
              :class="getAvatarById(player.avatar)!.color"
            />
            <span v-else class="text-white font-bold text-lg">
              {{ player.name.charAt(0).toUpperCase() }}
            </span>
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1">
              <span 
                class="text-white text-sm font-medium truncate max-w-[60px]"
                :class="{ 'text-amber-400': isLocal }"
              >
                {{ player.name }}
              </span>
              <Crown v-if="isLocal" class="w-3 h-3 text-amber-400 shrink-0" />
            </div>
            
            <div class="text-emerald-400 text-xs font-mono">
              ${{ player.chips.toLocaleString() }}
            </div>
          </div>
        </div>

        <!-- Folded indicator -->
        <div 
          v-if="player.folded"
          class="absolute inset-0 bg-gray-900/70 rounded-xl flex items-center justify-center"
        >
          <span class="text-gray-400 text-sm font-medium">已弃牌</span>
        </div>

        <!-- All-in indicator -->
        <div 
          v-if="player.isAllIn && !player.folded"
          class="absolute -bottom-3 left-1/2 transform -translate-x-1/2"
        >
          <span class="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">
            ALL IN
          </span>
        </div>
      </div>

      <!-- Turn timer indicator (below player card) -->
      <div 
        v-if="player.isTurn && !player.isAllIn"
        class="flex items-center justify-center gap-1 bg-amber-400 text-gray-900 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-lg shadow-amber-500/30 mt-1"
      >
        <Timer class="w-3 h-3" />
        <span>{{ isLocal ? '轮到你' : '思考中...' }}</span>
      </div>

      <!-- Current bet (absolutely positioned to avoid affecting layout) -->
      <div 
        v-if="player.bet > 0 && !player.folded" 
        class="absolute left-1/2 -translate-x-1/2"
        :class="position.y > 50 ? '-top-10' : 'top-full mt-1'"
      >
        <ChipStack :amount="player.bet" size="sm" />
      </div>

      <!-- Winner animation -->
      <div 
        v-if="isWinner"
        class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-linear-to-r from-amber-500 to-amber-400 text-gray-900 px-3 py-1 rounded-full font-bold text-sm shadow-lg shadow-amber-500/50 animate-bounce"
      >
        +${{ winAmount?.toLocaleString() }}
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Effect fade transition */
.effect-fade-enter-active {
  animation: effect-in 0.3s ease-out;
}
.effect-fade-leave-active {
  animation: effect-out 0.5s ease-in;
}
@keyframes effect-in {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes effect-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Bubble transition animation */
.bubble-enter-active {
  animation: bubble-in 0.3s ease-out;
}

.bubble-leave-active {
  animation: bubble-out 0.2s ease-in;
}

@keyframes bubble-in {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes bubble-out {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-5px) scale(0.9);
  }
}

/* Turn glow animations */
.glow-pulse {
  animation: glow-pulse 2s ease-in-out infinite;
}

.glow-pulse-delay {
  animation: glow-pulse 2s ease-in-out infinite;
  animation-delay: 0.5s;
}

@keyframes glow-pulse {
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}

/* Radial gradient for spotlight */
.bg-gradient-radial {
  background: radial-gradient(circle, var(--tw-gradient-from), var(--tw-gradient-via), var(--tw-gradient-to));
}

/* ========== RAISE EFFECT ========== */
.raise-effect {
  position: absolute;
  width: 100%;
  height: 100%;
}

.raise-particle {
  position: absolute;
  left: 50%;
  bottom: 50%;
  width: 8px;
  height: 8px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 50%;
  transform: translateX(var(--x));
  animation: raise-float 1.5s ease-out var(--delay) forwards;
  box-shadow: 0 0 6px #fbbf24;
}

@keyframes raise-float {
  0% {
    opacity: 1;
    transform: translateX(var(--x)) translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(var(--x)) translateY(-60px) scale(0.5);
  }
}

.raise-ring {
  animation: raise-ring-expand 1s ease-out forwards;
}

@keyframes raise-ring-expand {
  0% {
    opacity: 1;
    transform: scale(0.5);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

.raise-glow {
  animation: raise-glow-pulse 1s ease-out forwards;
}

@keyframes raise-glow-pulse {
  0% {
    opacity: 0.8;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1.2);
  }
}

/* ========== ALL-IN EFFECT ========== */
.allin-effect {
  position: absolute;
  width: 100%;
  height: 100%;
}

.fire-particle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 12px;
  background: linear-gradient(to top, #ef4444, #f97316, #fbbf24);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  transform-origin: center bottom;
  animation: fire-burst 2s ease-out calc(var(--i) * 0.08s) forwards;
}

@keyframes fire-burst {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(calc(var(--i) * 30deg)) translateY(0) scale(1);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(calc(var(--i) * 30deg)) translateY(-80px) scale(0.3);
  }
}

.allin-ring {
  animation: allin-ring-explode 1.5s ease-out forwards;
}

@keyframes allin-ring-explode {
  0% {
    opacity: 1;
    transform: scale(0.3);
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: scale(2);
  }
}

.allin-glow {
  animation: allin-glow-flash 1.5s ease-out forwards;
}

@keyframes allin-glow-flash {
  0% {
    opacity: 1;
    transform: scale(0.5);
  }
  20% {
    opacity: 1;
    transform: scale(1.2);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

/* ========== WINNER EFFECT ========== */
.winner-sparkles {
  position: absolute;
  width: 100%;
  height: 100%;
}

.sparkle {
  position: absolute;
  left: 50%;
  top: 50%;
  font-size: 16px;
  animation: sparkle-burst 2s ease-out calc(var(--i) * 0.1s) infinite;
}

@keyframes sparkle-burst {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(calc(var(--i) * 45deg)) translateY(0) scale(1);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(calc(var(--i) * 45deg)) translateY(-70px) scale(0.5);
  }
}

.winner-ring {
  animation: winner-ring-pulse 1.5s ease-out infinite;
}

@keyframes winner-ring-pulse {
  0% {
    opacity: 0.8;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.3);
  }
}

.winner-glow {
  animation: winner-glow-breathe 1.5s ease-in-out infinite;
}

@keyframes winner-glow-breathe {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* ========== TIP POPOVER ========== */
.tip-popover-enter-active {
  animation: tip-popover-in 0.2s ease-out;
}
.tip-popover-leave-active {
  animation: tip-popover-out 0.15s ease-in;
}

@keyframes tip-popover-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes tip-popover-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
}
</style>

