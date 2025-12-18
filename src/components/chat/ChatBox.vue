<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { ChatMessage } from '@/core/types'
import { Send, MessageCircle } from 'lucide-vue-next'
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

    <!-- Input area -->
    <div class="flex-shrink-0 p-4 border-t border-gray-700/50">
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

