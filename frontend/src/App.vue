<script setup lang="ts">
// Root component
</script>

<template>
  <div class="app-container d-flex flex-column align-items-center justify-content-center">
    <!-- Router View sẽ tự động hiển thị Login hoặc Home tùy vào URL -->
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background: radial-gradient(circle at center, var(--gv-bg-card) 0%, var(--gv-bg-dark) 100%);
  position: relative;
  overflow: hidden;
}

.app-container::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
  z-index: 0;
  pointer-events: none;
}

/* Page Transition Effects */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>