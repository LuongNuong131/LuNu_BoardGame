<script setup lang="ts">
import { useUiStore } from '@/stores/ui.store';
const uiStore = useUiStore();
const iconByTone = { success: 'bi-check2', error: 'bi-x-lg', info: 'bi-broadcast', warning: 'bi-exclamation' };
</script>

<template>
  <div class="toast-viewport" aria-live="polite" aria-atomic="true">
    <TransitionGroup name="toast" tag="div">
      <article v-for="toast in uiStore.toasts" :key="toast.id" class="lunu-toast glass-panel" :class="toast.tone">
        <span class="toast-icon"><i :class="`bi ${iconByTone[toast.tone]}`"></i></span><div class="toast-copy"><strong>{{ toast.title }}</strong><p>{{ toast.message }}</p></div><button class="toast-close" aria-label="Đóng" @click="uiStore.dismiss(toast.id)"><i class="bi bi-x"></i></button><span class="toast-progress"></span>
      </article>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-viewport{position:fixed;z-index:1000;top:22px;right:22px;width:min(360px,calc(100vw - 30px));pointer-events:none}.lunu-toast{position:relative;display:flex;align-items:flex-start;gap:10px;padding:13px 12px;margin-bottom:9px;overflow:hidden;pointer-events:auto;background:rgba(17,35,30,.96);box-shadow:0 18px 40px rgba(0,0,0,.3)}.toast-icon{display:grid;place-items:center;flex:0 0 auto;width:28px;height:28px;border-radius:9px;color:#17221e;background:var(--gv-primary);font-size:.7rem}.lunu-toast.error .toast-icon{color:#3a151c;background:#ef9a9e}.lunu-toast.info .toast-icon{color:#092a24;background:var(--gv-secondary)}.lunu-toast.warning .toast-icon{color:#3a2910;background:var(--gv-accent-warning)}.toast-copy{min-width:0;flex:1}.toast-copy strong{display:block;color:var(--gv-text-main);font-size:.68rem}.toast-copy p{color:var(--gv-text-muted);font-size:.6rem;line-height:1.45;margin:4px 0 0}.toast-close{border:0;color:var(--gv-text-dim);background:transparent;font-size:.85rem}.toast-progress{position:absolute;right:0;bottom:0;left:0;height:2px;background:var(--gv-primary);transform-origin:left;animation:toast-life 4.6s linear forwards}.error .toast-progress{background:#ef9a9e}.info .toast-progress{background:var(--gv-secondary)}.warning .toast-progress{background:var(--gv-accent-warning)}@keyframes toast-life{from{transform:scaleX(1)}to{transform:scaleX(0)}}.toast-enter-active,.toast-leave-active{transition:all .25s ease}.toast-enter-from,.toast-leave-to{opacity:0;transform:translateX(18px)}.toast-move{transition:transform .25s ease}
</style>
