<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  amount: number
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
}>()

// Calculate chip breakdown
const chips = computed(() => {
  let remaining = props.amount
  const breakdown: { value: number; color: string; count: number }[] = []

  const chipValues = [
    { value: 1000, color: 'bg-gray-800 border-gray-600' },
    { value: 500, color: 'bg-purple-600 border-purple-400' },
    { value: 100, color: 'bg-gray-900 border-gray-700' },
    { value: 25, color: 'bg-emerald-600 border-emerald-400' },
    { value: 5, color: 'bg-red-600 border-red-400' },
    { value: 1, color: 'bg-white border-gray-300' }
  ]

  for (const chip of chipValues) {
    const count = Math.floor(remaining / chip.value)
    if (count > 0) {
      breakdown.push({ ...chip, count: Math.min(count, 5) })
      remaining -= count * chip.value
    }
  }

  return breakdown.slice(0, 3) // Show max 3 stacks
})

// Total chip count
const totalChipCount = computed(() => {
  return chips.value.reduce((sum, stack) => sum + stack.count, 0)
})

// Chip size in pixels based on size prop
const chipSize = computed(() => {
  switch (props.size) {
    case 'sm': return 16  // w-4
    case 'lg': return 32  // w-8
    default: return 24    // w-6
  }
})

// Maximum width for chip area (in pixels)
const maxChipWidth = computed(() => {
  switch (props.size) {
    case 'sm': return 40
    case 'lg': return 80
    default: return 60
  }
})

// Dynamic overlap based on chip count
const chipOverlap = computed(() => {
  const count = totalChipCount.value
  if (count <= 1) return 0
  
  // Calculate needed overlap to fit within max width
  // Total width = chipSize + (count - 1) * (chipSize - overlap)
  // maxWidth = chipSize + (count - 1) * (chipSize - overlap)
  // Solve for overlap: overlap = chipSize - (maxWidth - chipSize) / (count - 1)
  
  const neededOverlap = chipSize.value - (maxChipWidth.value - chipSize.value) / (count - 1)
  
  // Clamp between min (4px) and max (chipSize - 2px, to show some of each chip)
  const minOverlap = 4
  const maxOverlap = chipSize.value - 4
  
  return Math.max(minOverlap, Math.min(maxOverlap, neededOverlap))
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return { chip: 'w-4 h-4', text: 'text-xs' }
    case 'lg':
      return { chip: 'w-8 h-8', text: 'text-base' }
    default:
      return { chip: 'w-6 h-6', text: 'text-sm' }
  }
})

function formatAmount(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`
  }
  return amount.toString()
}
</script>

<template>
  <div 
    class="flex items-center gap-1.5"
    :class="{ 'chip-bounce': animated }"
  >
    <!-- Chip stacks (left to right, with dynamic overlap) -->
    <div 
      class="flex items-center"
      :style="{ maxWidth: maxChipWidth + 'px' }"
    >
      <template v-for="(stack, i) in chips" :key="i">
        <div
          v-for="j in stack.count"
          :key="`${i}-${j}`"
          class="rounded-full border-2 shadow-md shrink-0"
          :class="[sizeClasses.chip, stack.color]"
          :style="{ marginLeft: (i > 0 || j > 1) ? `-${chipOverlap}px` : '0' }"
        ></div>
      </template>
    </div>

    <!-- Amount text -->
    <div 
      class="px-1.5 py-0.5 bg-gray-900/90 rounded font-bold text-amber-400 whitespace-nowrap"
      :class="sizeClasses.text"
    >
      ${{ formatAmount(amount) }}
    </div>
  </div>
</template>

<style scoped>
.chip-bounce {
  animation: chipBounce 0.5s ease-out;
}

@keyframes chipBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
</style>

