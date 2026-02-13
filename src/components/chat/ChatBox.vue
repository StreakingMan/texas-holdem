<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import type { ChatMessage } from "@/core/types";
import { Send, MessageCircle, ChevronDown, ChevronUp } from "lucide-vue-next";
import { getAvatarById } from "@/utils/avatars";

const props = defineProps<{
  messages: ChatMessage[];
  localPlayerId: string;
}>();

const emit = defineEmits<{
  send: [content: string];
}>();

const inputMessage = ref("");
const messagesContainer = ref<HTMLElement | null>(null);
const showAllPhrases = ref(false);

// 德州扑克场景快捷短语
const quickPhrases = [
  // 第一排（默认显示，常用的放前面）
  { emoji: "👍", text: "Nice hand!" },
  { emoji: "😎", text: "稳如老狗" },
  { emoji: "🔥", text: "手气火热中" },
  { emoji: "🤔", text: "让我想想..." },
  { emoji: "😱", text: "这都能中？" },
  { emoji: "🙏", text: "求放过" },
  { emoji: "⏰", text: "快点啊兄弟" },

  // 更多短语
  { emoji: "🃏", text: "All in 不解释" },
  { emoji: "💪", text: "这把我罩的" },
  { emoji: "🥺", text: "大哥行行好" },
  { emoji: "😭", text: "我只是个菜鸡" },
  { emoji: "💸", text: "筹码在燃烧" },
  { emoji: "🤡", text: "演技太差了" },
  { emoji: "🎭", text: "你在演我？" },
  { emoji: "🧐", text: "这牌有故事" },
  { emoji: "🤯", text: "河杀了！" },
  { emoji: "✨", text: "打得漂亮" },
  { emoji: "😴", text: "等到我睡着" },
  { emoji: "🍀", text: "求好运！" },
  { emoji: "👋", text: "gg，下把再来" },
  { emoji: "🎰", text: "赌一把！" },
  { emoji: "💀", text: "完蛋了" },
  { emoji: "🐟", text: "大鱼上钩" },
  { emoji: "🦈", text: "小心鲨鱼" },
  { emoji: "🤑", text: "数钱中..." },
  { emoji: "🫣", text: "不敢看了" },
  { emoji: "🤫", text: "闷声发大财" },
  { emoji: "😏", text: "就这？" },
  { emoji: "🧊", text: "冷静冷静" },
  { emoji: "☕", text: "喝口茶压压惊" },
  { emoji: "🎯", text: "精准狙击" },
];

// 默认显示的数量
const defaultVisibleCount = 7;

function sendQuickPhrase(phrase: { emoji: string; text: string }) {
  emit("send", `${phrase.emoji} ${phrase.text}`);
}

// Auto-scroll to bottom when new messages arrive
watch(
  () => props.messages.length,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop =
          messagesContainer.value.scrollHeight;
      }
    });
  },
);

function sendMessage(): void {
  const content = inputMessage.value.trim();
  if (!content) return;

  emit("send", content);
  inputMessage.value = "";
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSystemMessage(message: ChatMessage): boolean {
  return message.playerId === "system";
}

function isOwnMessage(message: ChatMessage): boolean {
  return message.playerId === props.localPlayerId;
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
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3">
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="text-center text-gray-500 py-8">
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
          'items-start': !isOwnMessage(message) && !isSystemMessage(message),
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
                v-if="
                  message.playerAvatar && getAvatarById(message.playerAvatar)
                "
                :is="getAvatarById(message.playerAvatar)!.icon"
                class="w-5 h-5"
                :class="getAvatarById(message.playerAvatar)!.color"
              />
              <span v-else class="text-white text-xs font-bold">
                {{ message.playerName.charAt(0).toUpperCase() }}
              </span>
            </div>

            <!-- Message content -->
            <div
              class="flex flex-col"
              :class="{ 'items-end': isOwnMessage(message) }"
            >
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
                  'bg-emerald-600 text-white rounded-br-sm':
                    isOwnMessage(message),
                  'bg-gray-700 text-gray-200 rounded-bl-sm':
                    !isOwnMessage(message),
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
      <!-- Single row with emoji buttons and more button -->
      <div class="flex items-center gap-1">
        <!-- Emoji buttons (first row) -->
        <template
          v-for="(phrase, index) in quickPhrases.slice(0, defaultVisibleCount)"
          :key="index"
        >
          <button
            @click="sendQuickPhrase(phrase)"
            class="group relative w-8 h-8 flex items-center justify-center hover:bg-gray-700/50 rounded-lg transition-colors text-lg flex-shrink-0"
          >
            {{ phrase.emoji }}
            <!-- Tooltip (positioned above, auto-adjust for edges) -->
            <span
              class="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-50 border border-gray-600 shadow-lg"
              :class="{
                'left-0': index === 0,
                'right-0': index === defaultVisibleCount - 1,
                'left-1/2 -translate-x-1/2': index > 0 && index < defaultVisibleCount - 1
              }"
            >
              {{ phrase.text }}
              <!-- Arrow -->
              <span
                class="absolute top-full border-4 border-transparent border-t-gray-900"
                :class="{
                  'left-3': index === 0,
                  'right-3': index === defaultVisibleCount - 1,
                  'left-1/2 -translate-x-1/2': index > 0 && index < defaultVisibleCount - 1
                }"
              ></span>
            </span>
          </button>
        </template>

        <!-- More button -->
        <button
          @click="showAllPhrases = !showAllPhrases"
          class="h-8 px-2 flex items-center gap-0.5 text-xs text-gray-400 hover:text-emerald-400 hover:bg-gray-700/50 rounded-lg transition-colors flex-shrink-0 ml-auto"
        >
          <component
            :is="showAllPhrases ? ChevronUp : ChevronDown"
            class="w-3 h-3 transition-transform duration-200"
          />
        </button>
      </div>

      <!-- Expanded emoji grid with animation -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-32"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 max-h-32"
        leave-to-class="opacity-0 max-h-0"
      >
        <div
          v-if="showAllPhrases"
          class="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-700/30"
        >
          <template
            v-for="(phrase, index) in quickPhrases.slice(defaultVisibleCount)"
            :key="'more-' + index"
          >
            <button
              @click="sendQuickPhrase(phrase)"
              class="group relative w-8 h-8 flex items-center justify-center hover:bg-gray-700/50 rounded-lg transition-colors text-lg"
            >
              {{ phrase.emoji }}
              <!-- Tooltip -->
              <span
                class="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-50 border border-gray-600 shadow-lg left-1/2 -translate-x-1/2"
              >
                {{ phrase.text }}
                <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></span>
              </span>
            </button>
          </template>
        </div>
      </Transition>
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
