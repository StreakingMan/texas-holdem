import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'

// Views
import HomeView from './views/HomeView.vue'
import GameView from './views/GameView.vue'

// Router configuration
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/game/:roomId',
      name: 'game',
      component: GameView
    }
  ]
})

// Create app with pinia first (needed for navigation guard)
const pinia = createPinia()
const app = createApp(App)
app.use(pinia)

// Import player store after pinia is installed
import { usePlayerStore } from './stores/player-store'

// Navigation guard to ensure player has a name before joining a game
router.beforeEach((to, _from, next) => {
  if (to.name === 'game') {
    const playerStore = usePlayerStore()
    
    // Try to load saved info first
    playerStore.loadSavedInfo()
    
    // If no player name, redirect to home with roomId to join
    if (!playerStore.playerName) {
      next({
        name: 'home',
        query: { join: to.params.roomId as string }
      })
      return
    }
  }
  next()
})

// Use router
app.use(router)

// Mount app
app.mount('#app')
