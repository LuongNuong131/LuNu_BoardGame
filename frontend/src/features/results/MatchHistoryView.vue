<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { GAME_BY_ID, GAME_CATALOG } from '@/data/games';
import { formatDate } from '@/utils/formatters';
import { errorMessage, fetchHistory, modes, outcomes, type MatchResult, type Outcome } from './results.api';
import './results.css';

const route = useRoute();
const router = useRouter();
const game = computed(() => typeof route.query.game === 'string' && Object.hasOwn(GAME_BY_ID, route.query.game) ? route.query.game : '');
const outcome = computed<Outcome | ''>(() => typeof route.query.outcome === 'string' && Object.hasOwn(outcomes, route.query.outcome) ? route.query.outcome as Outcome : '');
const matches = ref<MatchResult[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref('');
let controller: AbortController | undefined;

function setFilter(key: 'game' | 'outcome', value: string) {
  void router.replace({ query: { ...route.query, [key]: value || undefined } });
}

async function load(before?: string) {
  controller?.abort();
  const signal = (controller = new AbortController()).signal;
  loading.value = !before;
  loadingMore.value = Boolean(before);
  error.value = '';
  if (!before) {
    matches.value = [];
    nextCursor.value = null;
  }
  try {
    const page = await fetchHistory({ game: game.value || undefined, outcome: outcome.value || undefined, before }, signal);
    if (!signal.aborted) {
      if (before) matches.value.push(...page.items);
      else matches.value = page.items;
      nextCursor.value = page.nextCursor;
    }
  } catch (cause) {
    if (!signal.aborted) error.value = errorMessage(cause);
  } finally {
    if (!signal.aborted) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

const next = () => { if (nextCursor.value && !loadingMore.value) void load(nextCursor.value); };
watch([game, outcome], () => void load(), { immediate: true });
onScopeDispose(() => controller?.abort());
</script>

<template>
  <div class="page-frame results-page">
    <header class="results-hero">
      <div><h1>Lịch sử ván</h1><p>Xem lại kết quả các bàn bạn đã tham gia trực tuyến.</p></div>
      <i class="bi bi-clock-history" aria-hidden="true"></i>
    </header>
    <nav class="results-tabs" aria-label="Thành tích">
      <RouterLink to="/match-history" class="btn btn-quiet">Lịch sử ván</RouterLink>
      <RouterLink to="/leaderboard" class="btn btn-quiet">Bảng xếp hạng</RouterLink>
    </nav>

    <section class="glass-panel results-panel" aria-label="Kết quả ván" :aria-busy="loading || loadingMore">
      <div class="results-filters">
        <label><span id="game-filter-label">Trò chơi</span>
          <select class="form-select" aria-labelledby="game-filter-label" :value="game" @change="setFilter('game', ($event.target as HTMLSelectElement).value)">
            <option value="">Tất cả trò chơi</option>
            <option v-for="item in GAME_CATALOG" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>
        <label><span id="outcome-filter-label">Kết quả</span>
          <select class="form-select" aria-labelledby="outcome-filter-label" :value="outcome" @change="setFilter('outcome', ($event.target as HTMLSelectElement).value)">
            <option value="">Tất cả kết quả</option>
            <option v-for="(label, code) in outcomes" :key="code" :value="code">{{ label }}</option>
          </select>
        </label>
      </div>
      <p v-if="loading" class="results-message" role="status">Đang tải lịch sử…</p>
      <div v-else-if="error && !matches.length" class="results-message" role="alert">
        <h2>Lịch sử chưa tải được</h2><p>{{ error }}</p>
        <button class="btn btn-quiet" type="button" @click="load()">Thử lại</button>
      </div>
      <div v-else-if="!matches.length" class="results-message">
        <h2>{{ game || outcome ? 'Không tìm thấy ván phù hợp' : 'Bạn chưa có lịch sử ván' }}</h2>
        <button v-if="game || outcome" class="btn btn-quiet" type="button" @click="router.replace({ query: {} })">Xóa bộ lọc</button>
        <RouterLink v-else to="/rooms" class="btn btn-gold">Vào sảnh trực tuyến</RouterLink>
      </div>
      <template v-else>
        <ul class="match-list" aria-label="Các ván đã chơi">
          <li v-for="match in matches" :key="match.session_id" class="match-row">
            <span class="game-token" :style="{ color: GAME_BY_ID[match.game_id]?.accent }" aria-hidden="true"><i :class="['bi', GAME_BY_ID[match.game_id]?.icon || 'bi-controller']"></i></span>
            <div class="match-title">
              <strong>{{ GAME_BY_ID[match.game_id]?.name || match.game_id }}</strong>
              <span>{{ match.room_name }} · {{ modes[match.mode] }}</span>
            </div>
            <time :datetime="match.ended_at">{{ formatDate(match.ended_at) }}</time>
            <span class="outcome" :class="match.outcome.toLowerCase()">{{ outcomes[match.outcome] }}</span>
            <RouterLink v-if="match.can_view" :to="{ name: 'GameArena', params: { sessionId: match.session_id } }" class="btn btn-quiet match-link" :aria-label="`Xem ván ${match.room_name}, ${formatDate(match.ended_at)}`">Xem ván</RouterLink>
            <span v-else class="match-link removed">Phòng đã đóng</span>
          </li>
        </ul>
        <p v-if="error" class="results-message" role="alert">{{ error }}</p>
        <button v-if="nextCursor" class="btn btn-quiet more-results" type="button" :disabled="loadingMore" @click="next">{{ loadingMore ? 'Đang tải…' : error ? 'Thử tải lại' : 'Xem thêm' }}</button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.match-list { list-style: none; padding: 0; margin: 17px 0 0; display: grid; gap: 8px; }
.match-row { display: grid; grid-template-columns: auto minmax(130px, 1fr) minmax(150px, auto) minmax(84px, auto) 118px; gap: 11px; align-items: center; border: 1px solid #ffffff14; border-radius: 12px; padding: 11px; background: #08141174; }
.game-token { display: grid; place-items: center; width: 43px; height: 43px; border-radius: 10px; background: #ffffff0b; font-size: 1.15rem; }
.match-title { display: grid; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
.match-title span, time { font-size: .875rem; color: #bacac0; }
.outcome { justify-self: start; padding: 4px 9px; border-radius: 999px; background: #ffffff0e; color: #e0e7e1; font-size: .875rem; border: 1px solid #ffffff26; white-space: nowrap; }
.outcome.win { color: #a1e9c1; background: #32614450; border-color: #78ce9980; }
.outcome.loss { color: #ffc2bd; background: #743b3a4f; border-color: #d98b8580; }
.outcome.draw { color: #f9dc9e; background: #79623744; border-color: #bb9c5b80; }
.match-link { justify-self: end; }
.removed { color: #adbbb0; font-size: .85rem; }
.more-results { margin-top: 15px; }
@media (max-width: 850px) {
  .match-row { grid-template-columns: auto minmax(0, 1fr) auto; }
  .match-row time { grid-column: 2; grid-row: 2; }
  .match-row .outcome { grid-column: 3; grid-row: 1; justify-self: end; }
  .match-row .match-link { grid-column: 3; grid-row: 2; }
}
@media (max-width: 410px) {
  .match-row { grid-template-columns: minmax(0, 1fr) auto; }
  .match-row .game-token { display: none; }
  .match-row .outcome, .match-row .match-link { grid-column: 2; }
  .match-row time { grid-column: 1; }
}
</style>
