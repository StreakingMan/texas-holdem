<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePlayerStore } from '@/stores/player-store'
import { Spade, Users, Plus, LogIn } from 'lucide-vue-next'
import AvatarPicker from '@/components/common/AvatarPicker.vue'
import { getRandomAvatar } from '@/utils/avatars'

const router = useRouter()
const route = useRoute()
const playerStore = usePlayerStore()

const playerName = ref('')
const playerAvatar = ref('cat') // default avatar
const roomId = ref('')
const isCreating = ref(false)
const isJoining = ref(false)
const error = ref('')

// Check if joining via direct link
const joiningViaLink = computed(() => !!route.query.join)

onMounted(() => {
  playerStore.loadSavedInfo()
  if (playerStore.playerName) {
    playerName.value = playerStore.playerName
  }
  if (playerStore.avatar) {
    playerAvatar.value = playerStore.avatar
  } else {
    // Assign random avatar for new users
    playerAvatar.value = getRandomAvatar().id
  }
  
  // If coming from a direct link, pre-fill the room ID
  if (route.query.join) {
    roomId.value = (route.query.join as string).toUpperCase()
  }
})

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

async function createRoom(): Promise<void> {
  if (!playerName.value.trim()) {
    error.value = '请输入你的名字'
    return
  }

  isCreating.value = true
  error.value = ''

  try {
    playerStore.setPlayerInfo(playerName.value.trim(), playerAvatar.value)
    playerStore.saveInfo()

    const newRoomId = generateRoomId()
    playerStore.setRoomInfo(newRoomId, true)

    router.push(`/game/${newRoomId}`)
  } catch (e) {
    error.value = (e as Error).message
    isCreating.value = false
  }
}

async function joinRoom(): Promise<void> {
  if (!playerName.value.trim()) {
    error.value = '请输入你的名字'
    return
  }

  if (!roomId.value.trim()) {
    error.value = '请输入房间号'
    return
  }

  isJoining.value = true
  error.value = ''

  try {
    playerStore.setPlayerInfo(playerName.value.trim(), playerAvatar.value)
    playerStore.saveInfo()

    playerStore.setRoomInfo(roomId.value.trim().toUpperCase(), false)

    router.push(`/game/${roomId.value.trim().toUpperCase()}`)
  } catch (e) {
    error.value = (e as Error).message
    isJoining.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
    <!-- Animated background -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-emerald-900/20 to-transparent rounded-full blur-3xl animate-pulse"></div>
      <div class="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-amber-900/20 to-transparent rounded-full blur-3xl animate-pulse" style="animation-delay: 1s"></div>
    </div>

    <!-- Main card -->
    <div class="relative z-10 w-full max-w-md">
      <!-- Logo section -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/30 mb-4">
          <Spade class="w-10 h-10 text-white" />
        </div>
        <h1 class="text-4xl font-bold text-white mb-2" style="font-family: var(--font-display)">
          德州扑克
        </h1>
        <p class="text-emerald-400/80 text-sm">Texas Hold'em • 多人在线</p>
      </div>

      <!-- Card container -->
      <div class="bg-gradient-to-b from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden">
        <!-- Header decoration -->
        <div class="h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500"></div>

        <div class="p-6 space-y-6">
          <!-- Joining via link hint -->
          <div v-if="joiningViaLink" class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p class="text-amber-400 text-sm text-center">
              🎮 即将加入房间 <span class="font-mono font-bold">{{ roomId }}</span>
            </p>
            <p class="text-amber-400/70 text-xs text-center mt-1">
              请先输入你的昵称
            </p>
          </div>
          
          <!-- Player info (avatar + name) -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              <Users class="w-4 h-4 inline mr-2" />
              你的昵称
            </label>
            <div class="flex items-center gap-3">
              <!-- Avatar picker -->
              <AvatarPicker v-model="playerAvatar" />
              
              <!-- Name input -->
              <input
                v-model="playerName"
                type="text"
                placeholder="输入昵称..."
                maxlength="12"
                class="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                :autofocus="joiningViaLink"
              />
            </div>
          </div>

          <!-- Quick join button (when coming from link) -->
          <button
            v-if="joiningViaLink"
            @click="joinRoom"
            :disabled="isJoining"
            class="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn class="w-5 h-5" />
            {{ isJoining ? '加入中...' : '立即加入游戏' }}
          </button>

          <!-- Create room button (hidden when joining via link) -->
          <button
            v-if="!joiningViaLink"
            @click="createRoom"
            :disabled="isCreating"
            class="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus class="w-5 h-5" />
            {{ isCreating ? '创建中...' : '创建房间' }}
          </button>

          <!-- Divider (hidden when joining via link) -->
          <div v-if="!joiningViaLink" class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-700"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-4 bg-gray-800/80 text-gray-500">或者</span>
            </div>
          </div>

          <!-- Join room section (hidden when joining via link) -->
          <div v-if="!joiningViaLink" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                房间号
              </label>
              <input
                v-model="roomId"
                type="text"
                placeholder="输入6位房间号"
                maxlength="6"
                class="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all uppercase tracking-widest text-center text-lg font-mono"
              />
            </div>

            <button
              @click="joinRoom"
              :disabled="isJoining"
              class="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn class="w-5 h-5" />
              {{ isJoining ? '加入中...' : '加入房间' }}
            </button>
          </div>
          
          <!-- Back to normal mode link (when joining via link) -->
          <div v-if="joiningViaLink" class="text-center">
            <button
              @click="$router.replace('/')"
              class="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              或者创建自己的房间 →
            </button>
          </div>

          <!-- Error message -->
          <div v-if="error" class="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
            {{ error }}
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-gray-900/50 border-t border-gray-700/50">
          <p class="text-center text-gray-500 text-xs">
            使用 WebRTC 技术 • 点对点连接 • 无需服务器
          </p>
        </div>
      </div>

      <!-- Version info -->
      <p class="text-center text-gray-600 text-xs mt-4">
        v1.0.0 • Made with ♥
      </p>
    </div>
  </div>
</template>

