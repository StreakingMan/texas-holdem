<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { avatarList, getAvatarById } from '@/utils/avatars'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Group avatars by category
const avatarGroups = [
  { name: '动物', avatars: avatarList.slice(0, 10) },
  { name: '水果 & 自然', avatars: avatarList.slice(10, 18) },
  { name: '趣味', avatars: avatarList.slice(18, 28) },
  { name: '物品', avatars: avatarList.slice(28, 38) },
  { name: '冒险', avatars: avatarList.slice(38, 46) },
]

// Get current avatar info
const currentAvatar = computed(() => {
  return getAvatarById(props.modelValue) || avatarList[0]
})

// Popup positioning
const triggerRef = ref<HTMLElement | null>(null)
const showPicker = ref(false)
const popupPosition = ref({ top: 0, left: 0 })

const popupStyle = computed(() => ({
  top: `${popupPosition.value.top}px`,
  left: `${popupPosition.value.left}px`,
}))

async function togglePicker() {
  if (showPicker.value) {
    showPicker.value = false
    return
  }
  
  // Calculate position
  if (triggerRef.value) {
    const rect = triggerRef.value.getBoundingClientRect()
    // Position above the button
    popupPosition.value = {
      top: rect.top - 8, // 8px gap
      left: rect.left,
    }
  }
  
  showPicker.value = true
  
  // Adjust if popup goes off screen
  await nextTick()
  const popupHeight = 300 // approximate height
  if (popupPosition.value.top < popupHeight) {
    // Show below instead
    if (triggerRef.value) {
      const rect = triggerRef.value.getBoundingClientRect()
      popupPosition.value.top = rect.bottom + 8
    }
  }
}

function selectAvatar(id: string) {
  emit('update:modelValue', id)
  showPicker.value = false
}
</script>

<template>
  <div class="relative" ref="triggerRef">
    <!-- Current avatar button -->
    <button
      type="button"
      @click="togglePicker"
      class="w-14 h-14 rounded-full bg-gray-800 border-2 border-gray-600 hover:border-emerald-500 transition-all flex items-center justify-center group relative"
      title="点击选择头像"
    >
      <component 
        v-if="currentAvatar"
        :is="currentAvatar.icon" 
        class="w-8 h-8 transition-transform group-hover:scale-110"
        :class="currentAvatar.color"
      />
      <!-- Edit hint on hover -->
      <div class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span class="text-white text-xs">换</span>
      </div>
    </button>
    
    <!-- Picker popup (Teleport to body to avoid overflow issues) -->
    <Teleport to="body">
      <Transition name="popup">
        <div 
          v-if="showPicker"
          class="fixed z-50"
          :style="popupStyle"
        >
          <div class="w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
            <div class="p-2 border-b border-gray-700 flex items-center justify-between">
              <span class="text-sm text-gray-300 font-medium">选择头像</span>
              <button 
                @click="showPicker = false"
                class="text-gray-500 hover:text-white text-xs"
              >
                关闭
              </button>
            </div>
            
            <div class="max-h-64 overflow-y-auto p-2 space-y-3">
              <div v-for="group in avatarGroups" :key="group.name">
                <div class="text-xs text-gray-500 mb-1.5 px-1">{{ group.name }}</div>
                <div class="grid grid-cols-5 gap-1">
                  <button
                    v-for="avatar in group.avatars"
                    :key="avatar.id"
                    @click="selectAvatar(avatar.id)"
                    class="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:bg-gray-700"
                    :class="modelValue === avatar.id ? 'bg-emerald-600 ring-2 ring-emerald-400' : 'bg-gray-700/50'"
                  >
                    <component 
                      :is="avatar.icon" 
                      class="w-5 h-5"
                      :class="modelValue === avatar.id ? 'text-white' : avatar.color"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
      
      <!-- Backdrop -->
      <div 
        v-if="showPicker"
        class="fixed inset-0 z-40"
        @click="showPicker = false"
      ></div>
    </Teleport>
  </div>
</template>

<style scoped>
.popup-enter-active,
.popup-leave-active {
  transition: all 0.2s ease;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
