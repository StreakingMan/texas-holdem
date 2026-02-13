<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import type { ChatMessage } from '@/core/types'
import { Send, MessageCircle, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { getAvatarById } from '@/utils/avatars'

const props = defineProps<{
  messages: ChatMessage[]
  localPlayerId: string
}>()

const emit = defineEmits<{
  send: [content: string]
}>()

const inputMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const showAllPhrases = ref(false)

// 德州扑克场景快捷短语
const quickPhrases = [
  // 第一排（默认显示，常用的放前面）
  { emoji: '👍', text: 'Nice hand!' },
  { emoji: '😎', text: '稳如老狗' },
  { emoji: '🔥', text: '手气火热中' },
  { emoji: '🤔', text: '让我想想...' },
  { emoji: '😱', text: '这都能中？' },
  { emoji: '🙏', text: '求放过' },
  { emoji: '⏰', text: '快点啊兄弟' },
  
  // 更多短语
  { emoji: '🃏', text: 'All in 不解释' },
  { emoji: '💪', text: '这把我罩的' },
  { emoji: '🥺', text: '大哥行行好' },
  { emoji: '😭', text: '我只是个菜鸡' },
  { emoji: '💸', text: '筹码在燃烧' },
  { emoji: '🤡', text: '演技太差了' },
  { emoji: '🎭', text: '你在演我？' },
  { emoji: '🧐', text: '这牌有故事' },
  { emoji: '🤯', text: '河杀了！' },
  { emoji: '✨', text: '打得漂亮' },
  { emoji: '😴', text: '等到我睡着' },
  { emoji: '🍀', text: '求好运！' },
  { emoji: '👋', text: 'gg，下把再来' },
  { emoji: '🎰', text: '赌一把！' },
  { emoji: '💀', text: '完蛋了' },
  { emoji: '🐟', text: '大鱼上钩' },
  { emoji: '🦈', text: '小心鲨鱼' },
  { emoji: '🤑', text: '数钱中...' },
]

// 默认显示的数量
const defaultVisibleCount = 7

// 默认显示的短语
const visiblePhrases = computed(() => 
  showAllPhrases.value ? quickPhrases : quickPhrases.slice(0, defaultVisibleCount)
)

function sendQuickPhrase(phrase: { emoji: string; text: string }) {
  emit('send', `${phrase.emoji} ${phrase.text}`)
}

// Auto-scroll to bottom when new messages arrive
watch(() => props.messages.length, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
})

function sendMessage(): void {
  const content = inputMessage.value.trim()
  if (!content) return

  emit('send', content)
  inputMessage.value = ''
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isSystemMessage(message: ChatMessage): boolean {
  return message.playerId === 'system'
}

function isOwnMessage(message: ChatMessage): boolean {
  return message.playerId === props.localPlayerId
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex-shrink-0 px-4 py-3 border-b border-gray-700/50">
      <div class="flex items-center gap-2 text-gray-300">
        <MessageCircle class="w-5 h-5" />
        <span class="font-medium">聊天</span>
        <span class="text-gray-500 text-sm">({{ messages.length }})</span>
      </div>
    </div>

    <!-- Messages -->
    <div 
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-4 space-y-3"
    >
      <!-- Empty state -->
      <div 
        v-if="messages.length === 0"
        class="text-center text-gray-500 py-8"
      >
        <MessageCircle class="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p class="text-sm">暂无消息</p>
        <p class="text-xs">发送第一条消息吧!</p>
      </div>

      <!-- Message list -->
      <div 
        v-for="message in messages"
        :key="message.id"
        class="flex flex-col"
        :class="{
          'items-center': isSystemMessage(message),
          'items-end': isOwnMessage(message) && !isSystemMessage(message),
          'items-start': !isOwnMessage(message) && !isSystemMessage(message)
        }"
      >
        <!-- System message -->
        <div 
          v-if="isSystemMessage(message)"
          class="text-gray-500 text-xs py-1 px-3 bg-gray-800/50 rounded-full"
        >
          {{ message.content }}
        </div>

        <!-- User message -->
        <template v-else>
          <!-- Message with avatar -->
          <div 
            class="flex gap-2 max-w-[90%]"
            :class="{ 'flex-row-reverse': isOwnMessage(message) }"
          >
            <!-- Avatar -->
            <div 
              v-if="!isOwnMessage(message)"
              class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0"
            >
              <component 
                v-if="message.playerAvatar && getAvatarById(message.playerAvatar)"
                :is="getAvatarById(message.playerAvatar)!.icon"
                class="w-5 h-5"
                :class="getAvatarById(message.playerAvatar)!.color"
              />
              <span v-else class="text-white text-xs font-bold">
                {{ message.playerName.charAt(0).toUpperCase() }}
              </span>
            </div>

            <!-- Message content -->
            <div class="flex flex-col" :class="{ 'items-end': isOwnMessage(message) }">
              <!-- Sender name (for others' messages) -->
              <div 
                v-if="!isOwnMessage(message)"
                class="text-xs text-gray-400 mb-1 ml-1"
              >
                {{ message.playerName }}
              </div>

              <!-- Message bubble -->
              <div 
                class="px-3 py-2 rounded-2xl"
                :class="{
                  'bg-emerald-600 text-white rounded-br-sm': isOwnMessage(message),
                  'bg-gray-700 text-gray-200 rounded-bl-sm': !isOwnMessage(message)
                }"
              >
                <p class="text-sm break-words">{{ message.content }}</p>
              </div>

              <!-- Timestamp -->
              <div class="text-xs text-gray-500 mt-1 mx-1">
                {{ formatTime(message.timestamp) }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Quick phrases bar -->
    <div class="flex-shrink-0 px-4 py-2 border-t border-gray-700/50">
      <div 
        class="flex flex-wrap items-center gap-1"
        :class="{ 'max-h-8 overflow-hidden': !showAllPhrases }"
      >
        <!-- Emoji buttons -->
        <button
          v-for="(phrase, index) in visiblePhrases"
          :key="index"
          @click="sendQuickPhrase(phrase)"
          class="group relative w-8 h-8 flex items-center justify-center hover:bg-gray-700/50 rounded-lg transition-colors text-lg"
        >
          {{ phrase.emoji }}
          <!-- Tooltip -->
          <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-700">
            {{ phrase.text }}
          </span>
        </button>

        <!-- More/Less button -->
        <button
          @click="showAllPhrases = !showAllPhrases"
          class="h-8 px-2 flex items-center gap-0.5 text-xs text-gray-400 hover:text-emerald-400 hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          <span>{{ showAllPhrases ? '收起' : '更多' }}</span>
          <ChevronUp v-if="showAllPhrases" class="w-3 h-3" />
          <ChevronDown v-else class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Input area -->
    <div class="flex-shrink-0 px-4 pb-4 pt-2">
      <form @submit.prevent="sendMessage" class="flex gap-2">
        <input
          v-model="inputMessage"
          type="text"
          placeholder="输入消息..."
          maxlength="200"
          class="flex-1 px-4 py-2 bg-gray-800 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 text-sm"
        />
        <button
          type="submit"
          :disabled="!inputMessage.trim()"
          class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-colors"
        >
          <Send class="w-5 h-5" />
        </button>
      </form>
    </div>
  </div>
</template>

