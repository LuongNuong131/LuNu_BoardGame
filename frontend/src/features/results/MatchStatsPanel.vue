<script setup lang="ts">
import { useMatchStats } from './useMatchStats';
import { winRate } from './results.api';

const { stats, loading, error, load } = useMatchStats();
</script>

<template>
  <section class="match-stats glass-panel" aria-labelledby="match-stats-title">
    <h2 id="match-stats-title">Thành tích của bạn</h2>
    <p v-if="loading" role="status">Đang tải thành tích…</p>
    <div v-else-if="error" role="alert">
      <p>{{ error }}</p>
      <button class="btn btn-quiet" type="button" @click="load">Thử lại</button>
    </div>
    <template v-else-if="stats">
      <dl class="stat-grid">
        <div><dt>Ván đã xong</dt><dd>{{ stats.played.toLocaleString('vi-VN') }}</dd></div>
        <div><dt>Ván thắng</dt><dd>{{ stats.wins.toLocaleString('vi-VN') }}</dd></div>
        <div><dt>Tỷ lệ thắng</dt><dd>{{ winRate(stats) }}</dd></div>
      </dl>
      <p v-if="!stats.played">Kết quả sẽ xuất hiện sau ván trực tuyến đầu tiên của bạn.</p>
    </template>
    <nav class="stats-actions" aria-label="Thành tích">
      <RouterLink to="/match-history" class="btn btn-quiet">Lịch sử ván</RouterLink>
      <RouterLink to="/leaderboard" class="btn btn-quiet">Bảng xếp hạng</RouterLink>
    </nav>
  </section>
</template>

<style scoped>
.match-stats { padding: clamp(16px, 3vw, 24px); }
h2 { font: 650 1.35rem 'Playfair Display', Georgia, serif; margin: 0 0 14px; }
p { margin: 0 0 12px; color: var(--gv-text-muted); }
.stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin: 0 0 14px; }
.stat-grid div { display: flex; flex-direction: column-reverse; gap: 4px; min-width: 0; border: 1px solid #d6ad6226; border-radius: 10px; background: #d6ad620a; padding: 9px; }
dt { color: var(--gv-text-muted); font-size: .85rem; font-weight: 500; }
dd { color: var(--gv-primary-hover); margin: 0; font-weight: 800; font-size: clamp(.95rem, 2.3vw, 1.45rem); overflow-wrap: anywhere; }
.stats-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
