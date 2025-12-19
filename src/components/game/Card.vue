<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '@/core/types'
import { getSuitSymbol, getSuitColor } from '@/core/deck'

const props = defineProps<{
  card: Card | null
  faceDown?: boolean
  highlighted?: boolean
  size?: 'sm' | 'md' | 'lg'
  animationDelay?: number
}>()

// Use CSS variable-based sizing for responsiveness
const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'card-sm text-sm'
    case 'lg':
      return 'card-lg text-2xl'
    default:
      return 'card-md text-lg'
  }
})

const suitSymbol = computed(() => 
  props.card ? getSuitSymbol(props.card.suit) : ''
)

const suitColor = computed(() => 
  props.card ? getSuitColor(props.card.suit) : 'black'
)

const isUnknown = computed(() => 
  props.faceDown || !props.card
)
</script>

<template>
  <div 
    class="relative rounded-lg shadow-lg select-none"
    :class="[
      sizeClasses,
      highlighted ? 'ring-2 ring-amber-400 shadow-amber-400/50 scale-105' : ''
    ]"
    :style="{ 
      animationDelay: animationDelay ? `${animationDelay}ms` : '0ms'
    }"
  >
    <!-- Card face (shown when not unknown) -->
    <div 
      v-if="!isUnknown && card"
      class="w-full h-full bg-white rounded-lg flex flex-col justify-between p-1 border-2 overflow-hidden"
      :class="suitColor === 'red' ? 'border-red-200' : 'border-gray-200'"
    >
      <!-- Top rank and suit -->
      <div 
        class="font-bold leading-none shrink-0"
        :class="[
          suitColor === 'red' ? 'text-red-600' : 'text-gray-800',
          size === 'sm' ? 'text-xs' : 'text-sm'
        ]"
      >
        <div>{{ card.rank }}</div>
        <div :class="size === 'sm' ? 'text-[10px]' : 'text-xs'">{{ suitSymbol }}</div>
      </div>

      <!-- Center suit -->
      <div 
        class="text-center shrink-0"
        :class="[
          suitColor === 'red' ? 'text-red-600' : 'text-gray-800',
          size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl'
        ]"
      >
        {{ suitSymbol }}
      </div>

      <!-- Bottom rank and suit (inverted) -->
      <div 
        class="font-bold leading-none text-right rotate-180 shrink-0"
        :class="[
          suitColor === 'red' ? 'text-red-600' : 'text-gray-800',
          size === 'sm' ? 'text-xs' : 'text-sm'
        ]"
      >
        <div>{{ card.rank }}</div>
        <div :class="size === 'sm' ? 'text-[10px]' : 'text-xs'">{{ suitSymbol }}</div>
      </div>
    </div>

    <!-- Card back (shown when unknown/face down) -->
    <div 
      v-else
      class="w-full h-full bg-linear-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-blue-700 overflow-hidden"
    >
      <!-- Pattern -->
      <div class="w-full h-full p-1">
        <div class="w-full h-full border border-amber-400/30 rounded flex items-center justify-center">
          <div class="w-3/4 h-3/4 bg-linear-to-br from-amber-500/20 to-amber-600/20 rounded transform rotate-45"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Responsive card sizes using CSS variables */
.card-sm {
  width: var(--card-width-sm, 40px);
  height: var(--card-height-sm, 56px);
}
.card-md {
  width: var(--card-width-md, 56px);
  height: var(--card-height-md, 80px);
}
.card-lg {
  width: var(--card-width-lg, 80px);
  height: var(--card-height-lg, 112px);
}

@keyframes deal {
  0% {
    transform: translateY(-100px) scale(0.5);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.deal-animation {
  animation: deal 0.5s ease-out forwards;
}
</style>

