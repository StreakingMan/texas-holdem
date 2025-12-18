<script setup lang="ts">
import ChipStack from './ChipStack.vue'
import { Coins } from 'lucide-vue-next'

defineProps<{
  amount: number
  phase: string
}>()

// Phase display
const phaseNames: Record<string, string> = {
  'waiting': '等待中',
  'preflop': '翻牌前',
  'flop': '翻牌',
  'turn': '转牌',
  'river': '河牌',
  'showdown': '摊牌',
  'ended': '结束'
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <!-- Phase indicator -->
    <div class="px-3 py-1 bg-gray-900/80 rounded-full text-sm">
      <span class="text-gray-400">阶段:</span>
      <span class="text-white font-medium ml-1">{{ phaseNames[phase] || phase }}</span>
    </div>

    <!-- Pot display -->
    <div 
      v-if="amount > 0"
      class="flex flex-col items-center gap-1 bg-gray-900/60 backdrop-blur rounded-xl px-4 py-2 border border-amber-500/30"
    >
      <div class="flex items-center gap-2 text-amber-400">
        <Coins class="w-5 h-5" />
        <span class="text-sm font-medium">底池</span>
      </div>
      <ChipStack :amount="amount" size="md" />
    </div>
  </div>
</template>

