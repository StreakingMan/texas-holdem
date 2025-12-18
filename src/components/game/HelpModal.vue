<script setup lang="ts">
import { computed } from 'vue'
import { X, TrendingUp, Layers, Lightbulb, Sparkles } from 'lucide-vue-next'
import type { Card, GamePhase } from '@/core/types'

const props = defineProps<{
  show: boolean
  type: 'hand-rankings' | 'win-rate'
  playerCards?: Card[]
  communityCards?: Card[]
  phase?: GamePhase
}>()

const emit = defineEmits<{
  close: []
}>()

// Suit symbols
const suitSymbols: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠'
}
const suitColors: Record<string, string> = {
  hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-gray-900', spades: 'text-gray-900'
}

function formatCard(card: Card): string {
  return `${suitSymbols[card.suit]}${card.rank}`
}

// Hand rankings data with visual info
const handRankings = [
  { rank: 1, name: '皇家同花顺', desc: 'A到10同花色', example: '♠A ♠K ♠Q ♠J ♠10', prob: 0.000154, rarity: 5, color: 'from-amber-400 to-yellow-500' },
  { rank: 2, name: '同花顺', desc: '五张连续同花', example: '♥9 ♥8 ♥7 ♥6 ♥5', prob: 0.00139, rarity: 5, color: 'from-purple-400 to-pink-500' },
  { rank: 3, name: '四条', desc: '四张相同点数', example: '♠K ♥K ♦K ♣K ♠7', prob: 0.024, rarity: 4, color: 'from-red-400 to-rose-500' },
  { rank: 4, name: '葫芦', desc: '三条+一对', example: '♠Q ♥Q ♦Q ♣8 ♠8', prob: 0.144, rarity: 4, color: 'from-orange-400 to-amber-500' },
  { rank: 5, name: '同花', desc: '五张同花色', example: '♦K ♦J ♦8 ♦4 ♦2', prob: 0.197, rarity: 3, color: 'from-blue-400 to-cyan-500' },
  { rank: 6, name: '顺子', desc: '五张连续点数', example: '♠9 ♥8 ♦7 ♣6 ♠5', prob: 0.392, rarity: 3, color: 'from-emerald-400 to-green-500' },
  { rank: 7, name: '三条', desc: '三张相同点数', example: '♠7 ♥7 ♦7 ♣K ♠2', prob: 2.11, rarity: 2, color: 'from-teal-400 to-cyan-500' },
  { rank: 8, name: '两对', desc: '两组对子', example: '♠J ♥J ♦5 ♣5 ♠A', prob: 4.75, rarity: 2, color: 'from-sky-400 to-blue-500' },
  { rank: 9, name: '一对', desc: '两张相同点数', example: '♠10 ♥10 ♦K ♣7 ♠3', prob: 42.3, rarity: 1, color: 'from-slate-400 to-gray-500' },
  { rank: 10, name: '高牌', desc: '无任何牌型', example: '♠A ♥J ♦8 ♣5 ♠2', prob: 50.1, rarity: 1, color: 'from-gray-400 to-slate-500' },
]

// Format probability for display
function formatProb(prob: number): string {
  if (prob < 0.001) return prob.toFixed(5) + '%'
  if (prob < 0.01) return prob.toFixed(4) + '%'
  if (prob < 0.1) return prob.toFixed(3) + '%'
  if (prob < 1) return prob.toFixed(2) + '%'
  return prob.toFixed(1) + '%'
}

// Get pie chart color based on rarity
function getPieColor(rarity: number): string {
  const colors = ['#6b7280', '#6b7280', '#22d3ee', '#a855f7', '#f59e0b', '#fbbf24']
  return colors[rarity] || '#6b7280'
}

// Starting hand tiers (compact)
const handTiers = [
  { tier: 'S', hands: 'AA, KK, QQ, AKs', desc: '最强起手，激进加注' },
  { tier: 'A', hands: 'JJ, TT, AKo, AQs, AJs', desc: '优质牌，可以加注' },
  { tier: 'B', hands: '99-77, ATs, KQs, KJs, QJs', desc: '好牌，看位置行动' },
  { tier: 'C', hands: '66-22, 同花连牌, Axs', desc: '投机牌，便宜看牌' },
]

function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    'S': 'bg-amber-500 text-gray-900',
    'A': 'bg-emerald-500 text-white',
    'B': 'bg-blue-500 text-white',
    'C': 'bg-gray-500 text-white',
  }
  return colors[tier] || 'bg-gray-600 text-white'
}

// Check if game is in progress
const hasCards = computed(() => props.playerCards && props.playerCards.length >= 2)
const hasCommunityCards = computed(() => props.communityCards && props.communityCards.length > 0)

// Analyze current hand
const handAnalysis = computed(() => {
  if (!props.playerCards || props.playerCards.length < 2) return null
  
  const [card1, card2] = props.playerCards
  if (!card1 || !card2) return null
  
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const rank1 = ranks.indexOf(card1.rank)
  const rank2 = ranks.indexOf(card2.rank)
  const highRank = Math.max(rank1, rank2)
  const lowRank = Math.min(rank1, rank2)
  const gap = highRank - lowRank
  const isPair = card1.rank === card2.rank
  const isSuited = card1.suit === card2.suit
  
  // Starting hand tier
  let tier = 'D'
  let tierName = '弱牌'
  
  if (isPair) {
    if (highRank >= 12) { tier = 'S'; tierName = '顶级对子' }
    else if (highRank >= 9) { tier = 'A'; tierName = '高对子' }
    else if (highRank >= 6) { tier = 'B'; tierName = '中对子' }
    else { tier = 'C'; tierName = '小对子' }
  } else {
    const hasAce = highRank === 12
    const hasKing = highRank === 11
    const isConnected = gap <= 2
    
    if (hasAce && lowRank >= 11) { tier = 'S'; tierName = 'AK大牌' }
    else if (hasAce && lowRank >= 9) { tier = isSuited ? 'A' : 'B'; tierName = 'A高牌' }
    else if (hasKing && lowRank >= 9) { tier = isSuited ? 'B' : 'C'; tierName = 'K高牌' }
    else if (isSuited && isConnected && lowRank >= 5) { tier = 'B'; tierName = '同花连牌' }
    else if (isSuited && hasAce) { tier = 'C'; tierName = '同花A' }
    else if (isConnected && lowRank >= 7) { tier = 'C'; tierName = '连牌' }
  }
  
  return {
    tier,
    tierName,
    isPair,
    isSuited,
    highCard: ranks[highRank],
    connected: gap <= 2
  }
})

// Analyze with community cards
const boardAnalysis = computed(() => {
  if (!props.playerCards || props.playerCards.length < 2) return null
  if (!props.communityCards || props.communityCards.length === 0) return null
  
  const allCards = [...props.playerCards, ...props.communityCards]
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  
  // Count suits and ranks
  const suitCount: Record<string, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 }
  const rankCount: Record<string, number> = {}
  const rankIndices: number[] = []
  
  allCards.forEach(card => {
    const suitKey = card.suit as keyof typeof suitCount
    if (suitCount[suitKey] !== undefined) {
      suitCount[suitKey] = (suitCount[suitKey] ?? 0) + 1
    }
    rankCount[card.rank] = (rankCount[card.rank] || 0) + 1
    rankIndices.push(ranks.indexOf(card.rank))
  })
  
  // Check for made hands and draws
  const maxSuit = Math.max(...Object.values(suitCount))
  const pairs = Object.values(rankCount).filter(c => c === 2).length
  const trips = Object.values(rankCount).filter(c => c === 3).length
  const quads = Object.values(rankCount).filter(c => c === 4).length
  
  // Check straight potential
  const uniqueRanks = [...new Set(rankIndices)].sort((a, b) => a - b)
  let maxConsecutive = 1
  let currentConsecutive = 1
  for (let i = 1; i < uniqueRanks.length; i++) {
    const curr = uniqueRanks[i]!
    const prev = uniqueRanks[i - 1]!
    if (curr - prev === 1) {
      currentConsecutive++
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
    } else if (curr - prev > 2) {
      currentConsecutive = 1
    }
  }
  // Check A-2-3-4-5 wheel
  if (uniqueRanks.includes(12) && uniqueRanks.includes(0)) {
    const wheelRanks = [0, 1, 2, 3].filter(r => uniqueRanks.includes(r)).length
    maxConsecutive = Math.max(maxConsecutive, wheelRanks + 1)
  }
  
  const results: string[] = []
  let strength = 0
  
  // Made hands
  if (quads > 0) { results.push('🎰 四条！'); strength = 8 }
  else if (trips > 0 && pairs > 0) { results.push('🏠 葫芦！'); strength = 7 }
  else if (maxSuit >= 5) { results.push('🌸 同花！'); strength = 6 }
  else if (maxConsecutive >= 5) { results.push('📈 顺子！'); strength = 5 }
  else if (trips > 0) { results.push('🎯 三条'); strength = 4 }
  else if (pairs >= 2) { results.push('✌️ 两对'); strength = 3 }
  else if (pairs === 1) { 
    // Check if pair uses hole cards
    const c1 = props.playerCards[0]
    const c2 = props.playerCards[1]
    if (c1 && c2) {
      const holePair = c1.rank === c2.rank
      const boardHit = props.communityCards?.some(c => c.rank === c1.rank || c.rank === c2.rank)
      if (holePair) { results.push('🎯 暗三条潜力（口袋对）'); strength = 3 }
      else if (boardHit) { results.push('👆 击中一对'); strength = 2 }
      else { results.push('📋 公共牌对子'); strength = 1 }
    }
  }
  
  // Draws
  if (maxSuit === 4) results.push('💧 同花听牌 (差1张)')
  if (maxConsecutive === 4) results.push('🔗 顺子听牌 (差1张)')
  if (maxSuit === 3 && props.communityCards.length <= 3) results.push('💦 后门同花')
  if (maxConsecutive === 3 && props.communityCards.length <= 3) results.push('🔗 后门顺子')
  
  // Overcards check
  const card1 = props.playerCards[0]
  const card2 = props.playerCards[1]
  if (!card1 || !card2) return { analysis: ['无法分析'], advice: '', strength: 0 }
  const holeRanks = [ranks.indexOf(card1.rank), ranks.indexOf(card2.rank)]
  const boardRanks = props.communityCards.map(c => ranks.indexOf(c.rank))
  const maxBoard = Math.max(...boardRanks)
  const overcards = holeRanks.filter(r => r > maxBoard).length
  if (overcards === 2 && strength < 2) results.push('👑 两张高牌')
  else if (overcards === 1 && strength < 2) results.push('👆 一张高牌')
  
  if (results.length === 0) results.push('📋 高牌')
  
  // Advice based on phase and strength
  let advice = ''
  if (strength >= 5) advice = '强牌！可以激进下注'
  else if (strength >= 3) advice = '不错的牌力，可以跟注或适当加注'
  else if (results.some(r => r.includes('听牌'))) advice = '有听牌，看赔率决定是否跟注'
  else if (strength >= 2) advice = '中等牌力，谨慎行事'
  else advice = '牌力较弱，考虑弃牌或便宜看牌'
  
  return { results, advice, strength }
})

// Phase name
const phaseName = computed(() => {
  const names: Record<string, string> = {
    preflop: '翻牌前',
    flop: '翻牌圈',
    turn: '转牌圈',
    river: '河牌圈',
    showdown: '摊牌',
  }
  return names[props.phase || ''] || ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="emit('close')"
      >
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        
        <div class="relative bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl max-w-xl w-full overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div class="flex items-center gap-2">
              <div 
                class="w-8 h-8 rounded-lg flex items-center justify-center"
                :class="type === 'hand-rankings' ? 'bg-purple-500/20' : 'bg-amber-500/20'"
              >
                <Layers v-if="type === 'hand-rankings'" class="w-4 h-4 text-purple-400" />
                <TrendingUp v-else class="w-4 h-4 text-amber-400" />
              </div>
              <h2 class="text-base font-bold text-white">
                {{ type === 'hand-rankings' ? '牌型大小' : '起手牌指南' }}
              </h2>
            </div>
            <button 
              @click="emit('close')"
              class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <!-- Current Cards Display (if in game) -->
          <div v-if="hasCards" class="px-4 py-3 bg-gray-800/50 border-b border-gray-700/50">
            <div class="flex items-center gap-4">
              <!-- Hole Cards -->
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">手牌</span>
                <div class="flex gap-1">
                  <span 
                    v-for="(card, i) in playerCards" 
                    :key="i"
                    class="px-2 py-1 bg-white rounded text-sm font-bold shadow"
                    :class="suitColors[card.suit]"
                  >
                    {{ formatCard(card) }}
                  </span>
                </div>
              </div>
              
              <!-- Community Cards -->
              <div v-if="hasCommunityCards" class="flex items-center gap-2">
                <span class="text-xs text-gray-500">公共牌</span>
                <div class="flex gap-1">
                  <span 
                    v-for="(card, i) in communityCards" 
                    :key="i"
                    class="px-2 py-1 bg-white rounded text-sm font-bold shadow"
                    :class="suitColors[card.suit]"
                  >
                    {{ formatCard(card) }}
                  </span>
                </div>
              </div>
              
              <!-- Phase -->
              <div v-if="phaseName" class="ml-auto">
                <span class="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded">
                  {{ phaseName }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Dynamic Analysis -->
          <div v-if="hasCards && type === 'win-rate'" class="px-4 py-3 bg-amber-500/5 border-b border-amber-500/20">
            <!-- Starting Hand Analysis -->
            <div v-if="handAnalysis" class="flex items-start gap-3">
              <Lightbulb class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span 
                    class="px-1.5 py-0.5 rounded text-xs font-bold"
                    :class="getTierColor(handAnalysis.tier)"
                  >
                    {{ handAnalysis.tier }}级
                  </span>
                  <span class="text-amber-400 font-medium text-sm">{{ handAnalysis.tierName }}</span>
                  <span v-if="handAnalysis.isSuited" class="text-xs text-blue-400">同花</span>
                  <span v-if="handAnalysis.connected" class="text-xs text-purple-400">连牌</span>
                </div>
                
                <!-- Board Analysis -->
                <div v-if="boardAnalysis" class="mt-2 pt-2 border-t border-gray-700/50">
                  <div class="flex flex-wrap gap-1.5 mb-1.5">
                    <span 
                      v-for="(result, i) in boardAnalysis.results" 
                      :key="i"
                      class="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300"
                    >
                      {{ result }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-400">
                    <Sparkles class="w-3 h-3 inline text-amber-400 mr-1" />
                    {{ boardAnalysis.advice }}
                  </p>
                </div>
                
                <!-- Preflop advice -->
                <p v-else class="text-xs text-gray-400">
                  {{ handAnalysis.tier === 'S' ? '顶级起手牌，建议加注！' :
                     handAnalysis.tier === 'A' ? '优质起手牌，可以加注或跟注' :
                     handAnalysis.tier === 'B' ? '不错的牌，看位置决定行动' :
                     handAnalysis.tier === 'C' ? '投机牌，便宜看牌或弃牌' :
                     '弱牌，建议弃牌' }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Content -->
          <div class="p-3 overflow-y-auto max-h-[50vh]">
            <!-- Hand Rankings (2-column with pie chart) -->
            <div v-if="type === 'hand-rankings'" class="grid grid-cols-2 gap-1.5">
              <div 
                v-for="hand in handRankings"
                :key="hand.rank"
                class="flex items-center gap-2 px-2 py-1.5 bg-gray-800/50 rounded-lg"
              >
                <!-- Rank badge -->
                <div 
                  class="w-5 h-5 rounded bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs shrink-0"
                  :class="hand.color"
                >
                  {{ hand.rank }}
                </div>
                
                <!-- Name, desc and example -->
                <div class="flex-1 min-w-0 overflow-hidden">
                  <div class="flex items-center gap-1">
                    <span class="text-white text-sm font-medium">{{ hand.name }}</span>
                    <span class="text-gray-500 text-[10px]">{{ hand.desc }}</span>
                  </div>
                  <div class="flex flex-wrap gap-0.5">
                    <span 
                      v-for="(card, i) in hand.example.split(' ')"
                      :key="i"
                      class="text-[10px] font-mono"
                      :class="card.includes('♥') || card.includes('♦') ? 'text-red-400' : 'text-gray-400'"
                    >{{ card }}</span>
                  </div>
                </div>
                
                <!-- Pie chart + probability (fixed width, right aligned) -->
                <div class="flex flex-col items-center w-10 shrink-0 ml-auto">
                  <!-- Mini pie chart (SVG) -->
                  <svg width="24" height="24" viewBox="0 0 24 24" class="transform -rotate-90">
                    <!-- Background circle -->
                    <circle 
                      cx="12" cy="12" r="10" 
                      fill="none" 
                      stroke="currentColor" 
                      stroke-width="4"
                      class="text-gray-700"
                    />
                    <!-- Filled arc -->
                    <circle 
                      cx="12" cy="12" r="10" 
                      fill="none" 
                      :stroke="getPieColor(hand.rarity)"
                      stroke-width="4"
                      :stroke-dasharray="`${Math.max(0.5, hand.prob * 0.628)} 62.8`"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span 
                    class="text-[9px] font-mono mt-0.5 text-center"
                    :class="hand.rarity >= 4 ? 'text-amber-400' : hand.rarity >= 3 ? 'text-purple-400' : 'text-gray-500'"
                  >{{ formatProb(hand.prob) }}</span>
                </div>
              </div>
            </div>
            
            <!-- Win Rates (compact) -->
            <div v-else class="space-y-1.5">
              <div 
                v-for="item in handTiers"
                :key="item.tier"
                class="flex items-center gap-2 px-2 py-2 bg-gray-800/50 rounded-lg"
              >
                <span 
                  class="w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0"
                  :class="getTierColor(item.tier)"
                >
                  {{ item.tier }}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-white text-sm font-mono">{{ item.hands }}</div>
                  <div class="text-gray-400 text-xs">{{ item.desc }}</div>
                </div>
              </div>
              
              <!-- Quick legend -->
              <div class="mt-2 px-2 py-2 bg-gray-800/30 rounded-lg text-xs text-gray-500">
                s = 同花 | o = 杂色 | 胜率基于1v1场景
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>
