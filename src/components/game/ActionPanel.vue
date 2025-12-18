<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { PlayerAction } from '@/core/types'
import { X, Check, ArrowUp, Coins } from 'lucide-vue-next'

const props = defineProps<{
  isMyTurn: boolean
  availableActions: PlayerAction[]
  callAmount: number
  minRaise: number
  maxRaise: number
  currentBet: number
  playerChips: number
}>()

const emit = defineEmits<{
  action: [action: string, amount?: number]
}>()

const raiseAmount = ref(0)
const showRaiseSlider = ref(false)

// Reset raise amount when turn changes
watch(() => props.isMyTurn, (isTurn) => {
  if (isTurn) {
    raiseAmount.value = props.minRaise
    showRaiseSlider.value = false
  }
})

// Initialize raise amount
watch(() => props.minRaise, (min) => {
  if (raiseAmount.value < min) {
    raiseAmount.value = min
  }
}, { immediate: true })

// Check if action is available
function canDo(action: PlayerAction): boolean {
  return props.availableActions.includes(action)
}

// Action handlers
function fold(): void {
  emit('action', 'fold')
}

function check(): void {
  emit('action', 'check')
}

function call(): void {
  emit('action', 'call')
}

function raise(): void {
  if (showRaiseSlider.value) {
    emit('action', 'raise', raiseAmount.value)
    showRaiseSlider.value = false
  } else {
    showRaiseSlider.value = true
  }
}

function allIn(): void {
  emit('action', 'all-in')
}

// Quick raise amounts
const quickRaises = computed(() => {
  const pot = props.currentBet * 2 // Approximate pot
  return [
    { label: '1/2 底池', amount: Math.floor(pot / 2) },
    { label: '底池', amount: pot },
    { label: '2x', amount: props.minRaise * 2 },
    { label: '全下', amount: props.maxRaise }
  ].filter(r => r.amount >= props.minRaise && r.amount <= props.maxRaise)
})

function setQuickRaise(amount: number): void {
  raiseAmount.value = Math.min(amount, props.maxRaise)
}
</script>

<template>
  <!-- Floating action panel at bottom of table -->
  <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
    <!-- Waiting indicator (compact) -->
    <div 
      v-if="!isMyTurn" 
      class="bg-gray-900/90 backdrop-blur-md border border-gray-700/50 rounded-full px-5 py-2.5 shadow-xl"
    >
      <span class="inline-flex items-center gap-2 text-gray-400 text-sm">
        <span class="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></span>
        等待其他玩家操作...
      </span>
    </div>

    <!-- Action panel (your turn) -->
    <div 
      v-else
      class="relative bg-gray-900/90 backdrop-blur-md border border-amber-500/30 rounded-2xl shadow-2xl shadow-black/50 p-4 min-w-[500px]"
    >
      <!-- Raise slider bubble (pops up above) -->
      <div class="absolute bottom-full left-0 right-0 flex justify-center mb-3 pointer-events-none">
        <Transition name="slide-up">
          <div 
            v-if="showRaiseSlider && canDo('raise')"
            class="w-80 pointer-events-auto"
          >
            <div class="bg-gray-900/95 backdrop-blur-md rounded-xl p-3 border border-amber-500/50 shadow-xl">
            <!-- Rule hint -->
            <div class="text-center text-gray-400 text-xs mb-2 pb-2 border-b border-gray-700/50">
              最小加注 ${{ minRaise }}（需 ≥ 上次加注增量）
            </div>
            <!-- Slider -->
            <div class="flex items-center gap-3 mb-2">
              <span class="text-gray-400 text-xs min-w-[45px]">${{ minRaise }}</span>
              <input
                type="range"
                v-model.number="raiseAmount"
                :min="minRaise"
                :max="maxRaise"
                :step="Math.max(1, Math.floor(minRaise / 10))"
                class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span class="text-gray-400 text-xs min-w-[45px] text-right">${{ maxRaise }}</span>
            </div>

            <!-- Quick raise buttons -->
            <div class="flex items-center justify-center gap-1.5 flex-wrap">
              <button
                v-for="quick in quickRaises"
                :key="quick.label"
                @click="setQuickRaise(quick.amount)"
                class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                :class="{ 'bg-amber-600 text-white': raiseAmount === quick.amount }"
              >
                {{ quick.label }}
              </button>
              
              <!-- Custom amount input -->
              <input
                type="number"
                v-model.number="raiseAmount"
                :min="minRaise"
                :max="maxRaise"
                class="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-xs focus:outline-none focus:border-amber-500"
                placeholder="自定义"
              />
            </div>
            
            <!-- Arrow pointing down -->
            <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900/95"></div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Turn indicator -->
      <div class="flex items-center justify-center gap-2 mb-3 text-amber-400 text-sm font-medium">
        <span class="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
        轮到你了
      </div>
      
      <!-- Main actions row -->
      <div class="flex items-center justify-center gap-2">
        <!-- Fold -->
        <button
          v-if="canDo('fold')"
          @click="fold"
          class="flex items-center gap-1.5 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-all hover:scale-105 whitespace-nowrap"
        >
          <X class="w-4 h-4 text-red-400 shrink-0" />
          弃牌
        </button>

        <!-- Check -->
        <button
          v-if="canDo('check')"
          @click="check"
          class="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 whitespace-nowrap"
        >
          <Check class="w-4 h-4 shrink-0" />
          过牌
        </button>

        <!-- Call -->
        <button
          v-if="canDo('call')"
          @click="call"
          class="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-105 whitespace-nowrap"
        >
          <Coins class="w-4 h-4 shrink-0" />
          跟注 ${{ callAmount }}
        </button>

        <!-- Raise -->
        <button
          v-if="canDo('raise')"
          @click="raise"
          class="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl shadow-lg shadow-amber-500/30 transition-all hover:scale-105 whitespace-nowrap"
          :class="{ 'ring-2 ring-amber-400': showRaiseSlider }"
        >
          <ArrowUp class="w-4 h-4 shrink-0" />
          {{ showRaiseSlider ? `确认 $${raiseAmount}` : '加注' }}
        </button>

        <!-- All-in -->
        <button
          v-if="canDo('all-in')"
          @click="allIn"
          class="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all hover:scale-105 whitespace-nowrap"
        >
          <Coins class="w-4 h-4 shrink-0" />
          ALL IN ${{ playerChips }}
        </button>
      </div>

      <!-- Player info -->
      <div class="flex items-center justify-center gap-4 mt-3 text-xs text-gray-400">
        <span>筹码 <span class="text-emerald-400 font-medium">${{ playerChips.toLocaleString() }}</span></span>
        <span>•</span>
        <span>当前注 <span class="text-amber-400 font-medium">${{ currentBet }}</span></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Slide up transition for raise bubble */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.slide-up-enter-to,
.slide-up-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>

