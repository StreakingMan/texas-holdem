<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted, onUnmounted } from 'vue'

// Fix mobile viewport height (100vh includes address bar on mobile)
function setAppHeight() {
  const vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
}

onMounted(() => {
  setAppHeight()
  window.addEventListener('resize', setAppHeight)
  window.addEventListener('orientationchange', setAppHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', setAppHeight)
  window.removeEventListener('orientationchange', setAppHeight)
})
</script>

<template>
  <RouterView />
</template>

<style scoped>
</style>
