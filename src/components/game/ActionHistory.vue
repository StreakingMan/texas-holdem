<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { ActionRecord, GamePhase, SystemRecordType } from '@/stores/game-store'
import { History, Sparkles, CreditCard, Trophy, Play, Layers, Gift } from 'lucide-vue-next'
import { getAvatarById } from '@/utils/avatars'

const props = defineProps<{
  records: ActionRecord[]
}>()

const containerRef = ref<HTMLElement | null>(null)

// Auto-scroll to bottom when new records arrive
watch(() => props.records.length, () => {
  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTop = containerRef.value.scrollHeight
    }
  })
})

// Action name mapping
const actionNames: Record<string, string> = {
  'fold': '弃牌',
  'check': '过牌',
  'call': '跟注',
  'raise': '加注',
  'all-in': '全押'
}

// Phase name mapping
const phaseNames: Record<GamePhase, string> = {
  'waiting': '等待',
  'preflop': '翻牌前',
  'flop': '翻牌',
  'turn': '转牌',
  'river': '河牌',
  'showdown': '摊牌',
  'ended': '结束'
}

// System record type icons and colors
const systemTypeConfig: Record<SystemRecordType, { icon: string; bgClass: string; borderClass: string }> = {
  'hand-start': { icon: 'play', bgClass: 'bg-emerald-500/10', borderClass: 'border-l-emerald-500' },
  'blinds-posted': { icon: 'credit-card', bgClass: 'bg-blue-500/10', borderClass: 'border-l-blue-500' },
  'phase-flop': { icon: 'layers', bgClass: 'bg-purple-500/10', borderClass: 'border-l-purple-500' },
  'phase-turn': { icon: 'layers', bgClass: 'bg-amber-500/10', borderClass: 'border-l-amber-500' },
  'phase-river': { icon: 'layers', bgClass: 'bg-red-500/10', borderClass: 'border-l-red-500' },
  'showdown': { icon: 'sparkles', bgClass: 'bg-pink-500/10', borderClass: 'border-l-pink-500' },
  'winner': { icon: 'trophy', bgClass: 'bg-yellow-500/10', borderClass: 'border-l-yellow-500' },
  'hand-end': { icon: 'play', bgClass: 'bg-gray-500/10', borderClass: 'border-l-gray-500' },
  'tip': { icon: 'gift', bgClass: 'bg-pink-500/10', borderClass: 'border-l-pink-500' }
}

function getActionName(action: string): string {
  return actionNames[action] || action
}

function getPhaseName(phase: GamePhase): string {
  return phaseNames[phase] || phase
}

function getActionClass(action: string): string {
  switch (action) {
    case 'fold': return 'bg-gray-500'
    case 'check': return 'bg-blue-500'
    case 'call': return 'bg-emerald-500'
    case 'raise': return 'bg-amber-500'
    case 'all-in': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

function getPhaseClass(phase: GamePhase): string {
  switch (phase) {
    case 'preflop': return 'text-blue-400'
    case 'flop': return 'text-emerald-400'
    case 'turn': return 'text-amber-400'
    case 'river': return 'text-red-400'
    default: return 'text-gray-400'
  }
}

function getSystemConfig(systemType: SystemRecordType | undefined) {
  return systemType ? systemTypeConfig[systemType] : systemTypeConfig['hand-start']
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex-shrink-0 px-3 py-2 border-b border-gray-700/50">
      <div class="flex items-center gap-2 text-gray-300">
        <History class="w-4 h-4" />
        <span class="font-medium text-sm">操作记录</span>
      </div>
    </div>

    <!-- Records list -->
    <div 
      ref="containerRef"
      class="flex-1 overflow-y-auto"
    >
      <!-- Empty state -->
      <div 
        v-if="records.length === 0"
        class="text-center text-gray-500 py-6"
      >
        <History class="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p class="text-xs">暂无操作记录</p>
      </div>

      <!-- Record list -->
      <template v-for="record in records" :key="record.id">
        <!-- System record -->
        <div 
          v-if="record.isSystem"
          :class="[
            'px-3 py-2.5 border-b border-gray-800/50 border-l-2 transition-colors',
            getSystemConfig(record.systemType).bgClass,
            getSystemConfig(record.systemType).borderClass
          ]"
        >
          <div class="flex items-center gap-2">
            <!-- System icon -->
            <div class="w-5 h-5 flex items-center justify-center">
              <Play v-if="record.systemType === 'hand-start' || record.systemType === 'hand-end'" class="w-4 h-4 text-emerald-400" />
              <CreditCard v-else-if="record.systemType === 'blinds-posted'" class="w-4 h-4 text-blue-400" />
              <Layers v-else-if="record.systemType?.startsWith('phase-')" class="w-4 h-4 text-purple-400" />
              <Sparkles v-else-if="record.systemType === 'showdown'" class="w-4 h-4 text-pink-400" />
              <Trophy v-else-if="record.systemType === 'winner'" class="w-4 h-4 text-yellow-400" />
              <Gift v-else-if="record.systemType === 'tip'" class="w-4 h-4 text-pink-400" />
              <History v-else class="w-4 h-4 text-gray-400" />
            </div>
            
            <!-- System message -->
            <span class="text-gray-200 text-sm flex-1">
              {{ record.systemMessage }}
            </span>
            
            <!-- Time -->
            <span class="text-xs text-gray-500">
              {{ formatTime(record.timestamp) }}
            </span>
          </div>
          
          <!-- Community cards display -->
          <div v-if="record.communityCards && record.communityCards.length > 0" class="flex items-center gap-1 mt-1.5 ml-7">
            <span 
              v-for="(card, idx) in record.communityCards" 
              :key="idx"
              class="px-1.5 py-0.5 bg-white rounded text-xs font-bold shadow-sm"
              :class="card.includes('♥') || card.includes('♦') ? 'text-red-500' : 'text-gray-800'"
            >
              {{ card }}
            </span>
          </div>
          
          <!-- Pot info for system records -->
          <div v-if="record.potAfter && record.potAfter > 0" class="text-xs text-gray-500 mt-1 ml-7">
            当前底池 ${{ record.potAfter.toLocaleString() }}
          </div>
        </div>
        
        <!-- Player action record -->
        <div 
          v-else
          class="px-3 py-2 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
        >
          <!-- Top row: player name and action -->
          <div class="flex items-center gap-2">
            <!-- Player avatar -->
            <div class="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
              <component 
                v-if="record.playerAvatar && getAvatarById(record.playerAvatar)"
                :is="getAvatarById(record.playerAvatar)!.icon"
                class="w-3 h-3"
                :class="getAvatarById(record.playerAvatar)!.color"
              />
              <span v-else class="text-white text-[8px] font-bold">
                {{ record.playerName.charAt(0).toUpperCase() }}
              </span>
            </div>
            
            <!-- Player name -->
            <span class="text-gray-200 text-sm font-medium truncate">
              {{ record.playerName }}
            </span>
            
            <!-- Action badge -->
            <span 
              :class="getActionClass(record.action)"
              class="text-white text-xs px-1.5 py-0.5 rounded font-medium"
            >
              {{ getActionName(record.action) }}
            </span>
            
            <!-- Amount if exists -->
            <span v-if="record.amount" class="text-amber-400 text-sm font-mono font-bold ml-auto">
              ${{ record.amount.toLocaleString() }}
            </span>
          </div>

          <!-- Bottom row: details -->
          <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <!-- Phase -->
            <span v-if="record.phase" :class="getPhaseClass(record.phase)">
              {{ getPhaseName(record.phase) }}
            </span>
            
            <!-- Pot -->
            <span v-if="record.potAfter !== undefined && record.potAfter > 0">
              底池 ${{ record.potAfter.toLocaleString() }}
            </span>
            
            <!-- Player chips -->
            <span v-if="record.playerChipsAfter !== undefined && record.playerChipsAfter > 0">
              余额 ${{ record.playerChipsAfter.toLocaleString() }}
            </span>
            
            <!-- Time -->
            <span class="ml-auto">
              {{ formatTime(record.timestamp) }}
            </span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
