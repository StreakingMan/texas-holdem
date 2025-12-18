<script setup lang="ts">
import type { Player } from '@/core/types'
import { Copy, Check, Users, Crown, Play, Loader2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { getAvatarById } from '@/utils/avatars'

const props = defineProps<{
  players: Player[]
  isHost: boolean
  roomId: string
  canStart: boolean
}>()

const emit = defineEmits<{
  start: []
}>()

const copied = ref(false)

function copyRoomId(): void {
  navigator.clipboard.writeText(props.roomId)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function startGame(): void {
  emit('start')
}
</script>

<template>
  <div class="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
    <div class="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 p-4">
        <h2 class="text-xl font-bold text-white text-center" style="font-family: var(--font-display)">
          游戏大厅
        </h2>
      </div>

      <div class="p-6 space-y-6">
        <!-- Room ID -->
        <div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
          <div class="text-sm text-gray-400 mb-2 text-center">房间号</div>
          <div class="flex items-center justify-center gap-3">
            <span class="text-3xl font-bold font-mono tracking-widest text-amber-400">
              {{ roomId }}
            </span>
            <button 
              @click="copyRoomId"
              class="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              :title="copied ? '已复制' : '复制'"
            >
              <Check v-if="copied" class="w-5 h-5 text-emerald-400" />
              <Copy v-else class="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <p class="text-xs text-gray-500 text-center mt-2">
            分享房间号给好友即可加入
          </p>
        </div>

        <!-- Players list -->
        <div>
          <div class="flex items-center gap-2 text-gray-300 mb-3">
            <Users class="w-5 h-5" />
            <span class="font-medium">玩家列表</span>
            <span class="text-gray-500">({{ players.length }}/9)</span>
          </div>

          <div class="bg-gray-800/30 rounded-xl border border-gray-700/50 divide-y divide-gray-700/50">
            <!-- Player items -->
            <div 
              v-for="(player, index) in players"
              :key="player.id"
              class="flex items-center gap-3 p-3"
            >
              <!-- Avatar -->
              <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                <component 
                  v-if="player.avatar && getAvatarById(player.avatar)"
                  :is="getAvatarById(player.avatar)!.icon"
                  class="w-6 h-6"
                  :class="getAvatarById(player.avatar)!.color"
                />
                <span v-else class="text-white font-bold">
                  {{ player.name.charAt(0).toUpperCase() }}
                </span>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-white font-medium truncate">{{ player.name }}</span>
                  <Crown 
                    v-if="index === 0" 
                    class="w-4 h-4 text-amber-400 shrink-0" 
                    title="房主"
                  />
                </div>
                <div class="text-xs text-gray-500">
                  座位 {{ player.seatIndex + 1 }}
                </div>
              </div>

              <!-- Status -->
              <div class="flex items-center gap-1">
                <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span class="text-xs text-gray-400">在线</span>
              </div>
            </div>

            <!-- Empty slots -->
            <div 
              v-for="i in Math.max(0, 2 - players.length)"
              :key="'empty-' + i"
              class="flex items-center gap-3 p-3 opacity-50"
            >
              <div class="w-10 h-10 rounded-full bg-gray-700 border-2 border-dashed border-gray-600 flex items-center justify-center">
                <span class="text-gray-500 text-sm">?</span>
              </div>
              <span class="text-gray-500">等待玩家加入...</span>
            </div>
          </div>
        </div>

        <!-- Start button (host only) -->
        <div v-if="isHost">
          <button
            @click="startGame"
            :disabled="!canStart"
            class="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-gray-700 disabled:to-gray-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 disabled:shadow-none transition-all flex items-center justify-center gap-2"
          >
            <template v-if="canStart">
              <Play class="w-5 h-5" />
              开始游戏
            </template>
            <template v-else>
              <Loader2 class="w-5 h-5 animate-spin" />
              等待更多玩家 (至少2人)
            </template>
          </button>
        </div>

        <!-- Waiting message (non-host) -->
        <div v-else class="text-center py-4">
          <div class="inline-flex items-center gap-2 text-gray-400">
            <Loader2 class="w-5 h-5 animate-spin" />
            <span>等待房主开始游戏...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

