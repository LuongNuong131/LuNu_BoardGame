<script setup lang="ts">
import { useUiStore } from '@/stores/ui.store';
const uiStore = useUiStore();
</script>

<template>
  <Teleport to="body"><Transition name="confirm"><div v-if="uiStore.confirm.open" class="confirm-backdrop" @click.self="uiStore.resolveConfirm(false)"><section class="confirm-dialog glass-panel" role="dialog" aria-modal="true"><div class="confirm-mark"><i class="bi bi-shield-exclamation"></i></div><div class="confirm-copy"><div class="eyebrow">LuNu Security</div><h2>{{ uiStore.confirm.title }}</h2><p>{{ uiStore.confirm.message }}</p></div><div class="confirm-actions"><button class="btn btn-quiet" @click="uiStore.resolveConfirm(false)">{{ uiStore.confirm.cancelLabel }}</button><button class="btn btn-danger-soft" @click="uiStore.resolveConfirm(true)">{{ uiStore.confirm.confirmLabel }}<i class="bi bi-arrow-right ms-2"></i></button></div></section></div></Transition></Teleport>
</template>

<style scoped>
.confirm-backdrop{position:fixed;z-index:1100;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,9,8,.76);backdrop-filter:blur(10px)}.confirm-dialog{width:min(430px,100%);padding:24px;background:rgba(16,34,29,.98);box-shadow:0 24px 70px rgba(0,0,0,.38)}.confirm-mark{display:grid;place-items:center;width:42px;height:42px;margin-bottom:17px;border:1px solid rgba(239,154,158,.2);border-radius:13px;color:#ef9a9e;background:rgba(239,127,133,.08);font-size:1rem}.confirm-copy h2{font-size:1.15rem;font-weight:800;margin:7px 0}.confirm-copy p{color:var(--gv-text-muted);font-size:.68rem;line-height:1.6;margin:0}.confirm-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:23px}.btn-danger-soft{color:#ffdfe0;border:1px solid rgba(239,127,133,.3);background:rgba(239,127,133,.11);font-size:.64rem;font-weight:800}.btn-danger-soft:hover{color:#fff;background:#b75a65}.confirm-enter-active,.confirm-leave-active{transition:opacity .2s ease}.confirm-enter-from,.confirm-leave-to{opacity:0}
</style>
