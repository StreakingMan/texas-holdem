<script setup lang="ts">
import { computed } from 'vue'
import ChipStack from './ChipStack.vue'
import { Coins } from 'lucide-vue-next'
import type { Player, WinnerInfo, PlayerAction } from '@/core/types'

export interface LastActionInfo {
  playerId: string
  playerName: string
  action: PlayerAction
  amount?: number
}

const props = defineProps<{
  amount: number
  phase: string
  currentPlayerId?: string
  players: Player[]
  winners?: WinnerInfo[]
  lastAction?: LastActionInfo | null
  isHost?: boolean
}>()

// Phase display
const phaseNames: Record<string, string> = {
  'waiting': '等待开始',
  'preflop': '翻牌前',
  'flop': '翻牌',
  'turn': '转牌',
  'river': '河牌',
  'showdown': '摊牌',
  'ended': '本局结束'
}

// Format action text
function formatAction(action: PlayerAction, amount?: number): string {
  const actionTexts: Record<string, string> = {
    'fold': '弃牌',
    'check': '过牌',
    'call': '跟注',
    'raise': '加注',
    'all-in': '全下',
    'bet': '下注'
  }
  const text = actionTexts[action] || action
  if (amount && ['call', 'raise', 'all-in', 'bet'].includes(action)) {
    return `${text} $${amount}`
  }
  return text
}

// Current thinking player
const thinkingPlayer = computed(() => {
  if (!props.currentPlayerId) return null
  if (props.phase === 'waiting' || props.phase === 'ended' || props.phase === 'showdown') return null
  return props.players.find(p => p.id === props.currentPlayerId)
})

// Winner info
const winnerInfo = computed(() => {
  if (!props.winners || props.winners.length === 0) return null
  const winner = props.winners[0]
  if (!winner) return null
  const player = props.players.find(p => p.id === winner.playerId)
  return {
    name: player?.name || '玩家',
    amount: winner.amount,
    hand: winner.hand?.description || ''
  }
})

// Combined status text (single line)
const statusText = computed(() => {
  // Waiting phase
  if (props.phase === 'waiting') {
    return props.isHost ? '点击"开始游戏"开始' : '等待房主开始游戏'
  }
  
  // Ended phase with winner
  if ((props.phase === 'ended' || props.phase === 'showdown') && winnerInfo.value) {
    const handText = winnerInfo.value.hand ? `(${winnerInfo.value.hand})` : ''
    const waitText = props.isHost ? '点击下一局继续' : '等待房主开始下一局'
    return `${winnerInfo.value.name} 胜出 ${handText}，${waitText}`
  }
  
  // Active game - combine last action and current thinking player
  const parts: string[] = []
  
  if (props.lastAction) {
    const { playerName, action, amount } = props.lastAction
    parts.push(`${playerName} ${formatAction(action, amount)}`)
  }
  
  if (thinkingPlayer.value) {
    parts.push(`${thinkingPlayer.value.name} 思考中...`)
  }
  
  return parts.length > 0 ? parts.join('，') : null
})
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <!-- Phase indicator with status (single line) -->
    <div class="px-4 py-2 bg-gray-900/80 backdrop-blur rounded-xl text-sm">
      <div class="flex items-center justify-center gap-2 text-center">
        <span class="text-gray-400">{{ phaseNames[phase] || phase }}</span>
        <template v-if="statusText">
          <span class="text-gray-600">|</span>
          <span class="text-gray-300">{{ statusText }}</span>
        </template>
      </div>
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
