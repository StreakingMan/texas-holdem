<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import type { Player, PlayerAction, Card as CardType, GamePhase } from '@/core/types'
import Card from './Card.vue'
import ChipStack from './ChipStack.vue'
import { Crown, Wifi, WifiOff, Gift, Check, Droplet, Link, Clock, UserMinus } from 'lucide-vue-next'
import { getAvatarById } from '@/utils/avatars'
import { analyzeHand, analyzeStartingHand } from '@/core/hand-odds'

// Chat bubble message type
export interface BubbleMessage {
  content: string
  timestamp: number
}

export interface TipEffectInfo {
  type: 'sending' | 'receiving'
  amount: number
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
  communityCards?: CardType[]
  phase?: GamePhase
  tipEffect?: TipEffectInfo | null
  // 回合计时相关
  turnStartTime?: number
  turnTimeLimit?: number
  hasUsedExtension?: boolean
  // 房主踢人相关
  isHost?: boolean
}>()

const emit = defineEmits<{
  tip: [playerId: string, amount: number]
  openHandRankings: []
  requestExtension: []
  kickPlayer: [playerId: string]
}>()

// Bubble visibility state
const showBubble = ref(false)
const bubbleContent = ref('')
let bubbleTimer: ReturnType<typeof setTimeout> | null = null

// Action effect state
const showRaiseEffect = ref(false)
const showAllInEffect = ref(false)
let actionEffectTimer: ReturnType<typeof setTimeout> | null = null

// Direct tip - same amount for both mobile and desktop
const DIRECT_TIP_AMOUNT = 10

function handleTipClick() {
  if (props.player && (props.localPlayerChips ?? 0) >= DIRECT_TIP_AMOUNT) {
    emit('tip', props.player.id, DIRECT_TIP_AMOUNT)
  }
}

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

// 回合倒计时
const remainingTime = ref(0)
let countdownInterval: ReturnType<typeof setInterval> | null = null

// 计算剩余时间
function updateRemainingTime() {
  if (props.player?.isTurn && props.turnStartTime && props.turnTimeLimit) {
    const elapsed = Math.floor((Date.now() - props.turnStartTime) / 1000)
    remainingTime.value = Math.max(0, props.turnTimeLimit - elapsed)
  } else {
    remainingTime.value = 0
  }
}

// 倒计时进度百分比 (0-100)
const timerProgress = computed(() => {
  if (!props.turnTimeLimit || props.turnTimeLimit === 0) return 100
  return Math.max(0, Math.min(100, (remainingTime.value / props.turnTimeLimit) * 100))
})

// 是否显示警告状态（小于10秒）
const isTimerWarning = computed(() => remainingTime.value > 0 && remainingTime.value <= 10)

// 是否显示倒计时
const showTimer = computed(() => props.player?.isTurn && !props.player?.isAllIn && props.turnStartTime)

// 延时费用
const EXTENSION_COST = 10

// 是否可以请求延时（仅本地玩家、轮到自己、有足够筹码、未使用过延时）
const canRequestExtension = computed(() => {
  return (
    props.isLocal &&
    props.player?.isTurn &&
    !props.hasUsedExtension &&
    (props.localPlayerChips ?? 0) >= EXTENSION_COST
  )
})

function handleExtensionClick() {
  emit('requestExtension')
}

function handleKickClick() {
  if (props.player && props.isHost && !props.isLocal) {
    emit('kickPlayer', props.player.id)
  }
}

// 监听 isTurn 变化，启动/停止倒计时
watch(
  () => [props.player?.isTurn, props.turnStartTime, props.turnTimeLimit],
  () => {
    if (props.player?.isTurn && props.turnStartTime) {
      // 启动倒计时
      updateRemainingTime()
      if (countdownInterval) clearInterval(countdownInterval)
      countdownInterval = setInterval(updateRemainingTime, 1000)
    } else {
      // 停止倒计时
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
      remainingTime.value = 0
    }
  },
  { immediate: true }
)

// Cleanup timer on unmount
onUnmounted(() => {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer)
  }
  if (actionEffectTimer) {
    clearTimeout(actionEffectTimer)
  }
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
})

// Position styles (only local player offset up by 40px)
const positionStyle = computed(() => ({
  left: `${props.position.x}%`,
  top: `${props.position.y}%`,
  transform: props.isLocal 
    ? 'translate(-50%, calc(-50% - 40px))' 
    : 'translate(-50%, -50%)'
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
  if (props.player.folded) return 'opacity-40'
  return ''
})

// Starting hand analysis (preflop only)
const startingHandInfo = computed(() => {
  if (!props.isLocal || !props.player || props.player.cards.length < 2) return null
  if (props.phase !== 'preflop' && props.communityCards && props.communityCards.length > 0) return null
  
  return analyzeStartingHand(props.player.cards)
})

// Hand odds analysis (always available when has community cards)
const handOddsInfo = computed(() => {
  if (!props.isLocal || !props.player || props.player.cards.length < 2) return null
  if (!props.communityCards || props.communityCards.length === 0) return null
  if (!props.phase || !['flop', 'turn', 'river'].includes(props.phase)) return null
  
  // analyzeHand already returns top 3 sorted by probability
  return analyzeHand(props.player.cards, props.communityCards, props.phase)
})

// Check if we have any hints to show
const hasHints = computed(() => {
  return startingHandInfo.value || (handOddsInfo.value && handOddsInfo.value.length > 0)
})

// Tier color mapping
function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    'S': 'bg-amber-500 text-gray-900',
    'A': 'bg-emerald-500 text-white',
    'B': 'bg-blue-500 text-white',
    'C': 'bg-gray-500 text-white',
    'D': 'bg-gray-700 text-gray-400',
  }
  return colors[tier] || 'bg-gray-700 text-gray-400'
}
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
      class="seat-empty rounded-full bg-gray-800/50 border-2 border-dashed border-gray-600 flex items-center justify-center"
    >
      <span class="text-gray-500 seat-text-sm">空座</span>
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
            <p class="text-sm wrap-break-word line-clamp-2">{{ bubbleContent }}</p>
            <!-- Arrow pointing down -->
            <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-white"></div>
          </div>
        </div>
      </Transition>

      <!-- Cards (above avatar) with hand hints for local player -->
      <div class="relative mb-1">
        <!-- Cards -->
        <div class="flex gap-1">
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
        
        <!-- Hand hints (only for local player) - show on all screen sizes -->
        <Transition name="hint-fade">
          <div 
            v-if="isLocal && hasHints && displayCards.length > 0 && !player.folded"
            class="flex absolute left-full top-0 ml-1 sm:ml-2 flex-col gap-1 sm:gap-1.5 bg-gray-900/90 backdrop-blur rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 border border-gray-700/50 shadow-lg min-w-[80px] sm:min-w-[100px] max-w-[120px] sm:max-w-[160px]"
          >
            <!-- Preflop: Starting hand tier -->
            <div v-if="startingHandInfo" class="flex flex-col gap-0.5">
              <span class="text-[9px] sm:text-[10px] text-gray-500 font-medium">起手牌力</span>
              <div class="flex items-center gap-1 sm:gap-1.5">
                <span 
                  class="px-1 py-0.5 rounded text-[10px] sm:text-xs font-bold"
                  :class="getTierColor(startingHandInfo.tier)"
                >
                  {{ startingHandInfo.tier }}
                </span>
                <span class="text-gray-300 text-[10px] sm:text-xs truncate">{{ startingHandInfo.name }}</span>
              </div>
              <span class="hidden sm:block text-[11px] text-gray-500 truncate">{{ startingHandInfo.tip }}</span>
            </div>
            
            <!-- Post-flop: Hand odds -->
            <div v-if="handOddsInfo && handOddsInfo.length > 0" class="flex flex-col gap-0.5">
              <span class="text-[9px] sm:text-[10px] text-gray-500 font-medium">中牌概率</span>
              <div 
                v-for="(suggestion, i) in handOddsInfo" 
                :key="i"
                class="flex items-center gap-0.5 sm:gap-1"
                :title="suggestion.tip"
              >
                <Check v-if="suggestion.type === 'made'" class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
                <Droplet v-else-if="suggestion.icon === 'droplet' || suggestion.icon === 'droplets'" class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-400 shrink-0" />
                <Link v-else class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-400 shrink-0" />
                <span 
                  class="text-[10px] sm:text-xs font-medium truncate"
                  :class="suggestion.type === 'made' ? 'text-emerald-400' : 'text-gray-300'"
                >
                  {{ suggestion.name }}
                </span>
                <span class="text-[9px] sm:text-[11px] text-gray-500 ml-auto whitespace-nowrap">{{ suggestion.probability }}%</span>
              </div>
              <!-- View more button -->
              <button 
                @click="emit('openHandRankings')"
                class="mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-amber-400 hover:text-amber-300 text-center transition-colors"
              >
                查看更多 →
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Avatar and info -->
      <div 
        class="relative bg-gray-800/90 rounded-xl seat-padding seat-min-w backdrop-blur transition-all duration-300"
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

        <!-- Tip button (for non-local players) - mobile: direct $10 tip, desktop: show popover -->
        <button
          v-if="!isLocal && player.isConnected"
          @click.stop="handleTipClick"
          class="flex absolute -bottom-3 -right-3 w-5 h-5 sm:w-6 sm:h-6 bg-pink-500 hover:bg-pink-400 text-white rounded-full items-center justify-center shadow-lg transition-all hover:scale-110 z-20"
          title="打赏 $10"
        >
          <Gift class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        </button>

        <!-- Kick button (for host only, on non-local players) -->
        <button
          v-if="isHost && !isLocal"
          @click.stop="handleKickClick"
          class="flex absolute -bottom-3 -left-3 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 hover:bg-red-400 text-white rounded-full items-center justify-center shadow-lg transition-all hover:scale-110 z-20"
          title="踢出房间"
        >
          <UserMinus class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        </button>

        <!-- Player avatar and info -->
        <div class="flex items-center gap-1 sm:gap-2">
          <div 
            class="seat-avatar rounded-full bg-gray-700 flex items-center justify-center shrink-0"
          >
            <component 
              v-if="player.avatar && getAvatarById(player.avatar)"
              :is="getAvatarById(player.avatar)!.icon"
              class="seat-avatar-icon"
              :class="getAvatarById(player.avatar)!.color"
            />
            <span v-else class="text-white font-bold seat-text-lg">
              {{ player.name.charAt(0).toUpperCase() }}
            </span>
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1">
              <span 
                class="text-white seat-text-name font-medium truncate max-w-[50px] sm:max-w-[60px]"
                :class="{ 'text-amber-400': isLocal }"
              >
                {{ player.name }}
              </span>
              <Crown v-if="isLocal" class="w-3 h-3 text-amber-400 shrink-0 hidden sm:block" />
            </div>
            
            <div class="text-emerald-400 seat-text-chips font-mono">
              ${{ player.chips.toLocaleString() }}
            </div>
          </div>
        </div>

        <!-- Mid-game join indicator (takes priority over folded) -->
        <div 
          v-if="player.joinedMidGame"
          class="absolute inset-0 bg-blue-900/70 rounded-xl flex items-center justify-center"
        >
          <span class="text-blue-300 text-sm font-medium">等待下一局</span>
        </div>

        <!-- Folded indicator -->
        <div 
          v-else-if="player.folded"
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

      <!-- Turn timer indicator (absolutely positioned below player card) -->
      <div 
        v-if="showTimer"
        class="absolute left-1/2 -translate-x-1/2 top-full mt-1 flex items-center gap-1 z-10"
      >
        <!-- 倒计时显示 -->
        <div 
          class="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-lg transition-colors duration-300"
          :class="isTimerWarning 
            ? 'bg-red-500 text-white shadow-red-500/50 animate-pulse' 
            : 'bg-amber-400 text-gray-900 shadow-amber-500/30'"
        >
          <!-- 圆形进度指示器 -->
          <div class="relative w-4 h-4">
            <svg class="w-4 h-4 -rotate-90" viewBox="0 0 20 20">
              <!-- 背景圆 -->
              <circle
                cx="10" cy="10" r="8"
                fill="none"
                :stroke="isTimerWarning ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'"
                stroke-width="3"
              />
              <!-- 进度圆 -->
              <circle
                cx="10" cy="10" r="8"
                fill="none"
                :stroke="isTimerWarning ? '#fff' : '#1f2937'"
                stroke-width="3"
                stroke-linecap="round"
                :stroke-dasharray="50.27"
                :stroke-dashoffset="50.27 * (1 - timerProgress / 100)"
                class="transition-all duration-1000 ease-linear"
              />
            </svg>
            <Clock class="absolute inset-0 w-2.5 h-2.5 m-auto" :class="isTimerWarning ? 'text-white' : 'text-gray-900'" />
          </div>
          <!-- 倒计时文字 -->
          <span>
            {{ isLocal ? '轮到你' : '思考中' }}
            <span class="tabular-nums">{{ remainingTime }}s</span>
          </span>
        </div>
        
        <!-- 延时按钮 -->
        <button
          v-if="canRequestExtension"
          @click.stop="handleExtensionClick"
          class="flex items-center gap-0.5 px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-medium rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
          title="支付 $10 延长 30 秒"
        >
          <span>+30s</span>
          <span class="text-emerald-200">$10</span>
        </button>
      </div>

      <!-- Current bet (absolutely positioned to avoid affecting layout) -->
      <div 
        v-if="player.bet > 0 && !player.folded" 
        class="absolute left-1/2 -translate-x-1/2"
        :class="position.y > 50 ? '-top-6' : 'top-full'"
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

      <!-- Tip sending effect (shows amount badge only, coins fly in PokerTable) -->
      <Transition name="tip-badge">
        <div 
          v-if="tipEffect?.type === 'sending'"
          class="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none z-30"
        >
          <div class="bg-red-500/90 text-white px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap shadow-lg shadow-red-500/50">
            -${{ tipEffect.amount }}
          </div>
        </div>
      </Transition>

      <!-- Tip receiving effect (amount badge only) -->
      <Transition name="tip-receive">
        <div 
          v-if="tipEffect?.type === 'receiving'"
          class="absolute inset-0 pointer-events-none z-30"
        >
          <!-- Amount badge -->
          <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap shadow-lg shadow-emerald-500/50 tip-badge-in">
            +${{ tipEffect.amount }}
          </div>
        </div>
      </Transition>
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


/* ========== HAND HINTS ========== */
.hint-fade-enter-active {
  animation: hint-in 0.3s ease-out;
}

.hint-fade-leave-active {
  animation: hint-out 0.2s ease-in;
}

@keyframes hint-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes hint-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(8px);
  }
}

/* ========== TIP EFFECT ========== */

/* Badge transition for sending */
.tip-badge-enter-active {
  animation: tip-badge-in 0.4s ease-out;
}
.tip-badge-leave-active {
  animation: tip-badge-out 0.8s ease-in forwards;
}

@keyframes tip-badge-in {
  0% { opacity: 0; transform: scale(0.5) translateY(10px); }
  50% { opacity: 1; transform: scale(1.2) translateY(-5px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes tip-badge-out {
  0% { opacity: 1; transform: scale(1) translateY(0); }
  100% { opacity: 0; transform: scale(0.8) translateY(-20px); }
}

/* Receiving effect transition */
.tip-receive-enter-active {
  animation: tip-receive-in 0.4s ease-out;
}
.tip-receive-leave-active {
  animation: tip-receive-out 0.6s ease-in forwards;
}

@keyframes tip-receive-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes tip-receive-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Receiving badge animation */
.tip-badge-in {
  animation: tip-badge-bounce-in 0.5s ease-out;
}

@keyframes tip-badge-bounce-in {
  0% { transform: scale(0); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
</style>

