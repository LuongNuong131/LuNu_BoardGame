<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { GAME_BY_ID, GAME_CATALOG } from '@/data/games';
import { errorMessage, fetchLeaderboard, winRate, type RankingPeriod } from './results.api';
import './results.css';

const route = useRoute();
const router = useRouter();
const games = GAME_CATALOG.filter((item) => item.id !== 'BLACKJACK');
const game = computed(() => typeof route.query.game === 'string' && route.query.game !== 'BLACKJACK' && Object.hasOwn(GAME_BY_ID, route.query.game) ? route.query.game : '');
const period = computed<RankingPeriod>(() => route.query.period === 'all' ? 'all' : '30d');
const board = ref<Awaited<ReturnType<typeof fetchLeaderboard>>>();
const loading = ref(true);
const error = ref('');
let controller: AbortController | undefined;

function setFilter(key: 'game' | 'period', value: string) {
  void router.replace({ query: { ...route.query, [key]: value || undefined } });
}

async function load() {
  controller?.abort();
  const signal = (controller = new AbortController()).signal;
  board.value = undefined;
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchLeaderboard({ game: game.value || undefined, period: period.value }, signal);
    if (!signal.aborted) board.value = data;
  } catch (cause) {
    if (!signal.aborted) error.value = errorMessage(cause);
  } finally {
    if (!signal.aborted) loading.value = false;
  }
}

const points = (value: number) => value.toLocaleString('vi-VN');
const leaderboardScope = computed(() => `${game.value ? GAME_BY_ID[game.value].name : 'Tất cả trò chơi'} · ${period.value === '30d' ? '30 ngày gần đây' : 'Mọi thời điểm'}`);
watch([game, period], load, { immediate: true });
onScopeDispose(() => controller?.abort());
</script>

<template>
  <div class="page-frame results-page">
    <header class="results-hero">
      <div><h1>Bảng xếp hạng</h1><p>So thành tích của bạn với các thành viên LuNu theo từng trò hoặc toàn câu lạc bộ.</p></div>
      <i class="bi bi-trophy" aria-hidden="true"></i>
    </header>
    <nav class="results-tabs" aria-label="Thành tích">
      <RouterLink to="/match-history" class="btn btn-quiet">Lịch sử ván</RouterLink>
      <RouterLink to="/leaderboard" class="btn btn-quiet">Bảng xếp hạng</RouterLink>
    </nav>

    <section class="glass-panel results-panel" aria-label="Xếp hạng thành viên" :aria-busy="loading">
      <div class="results-filters">
        <label><span id="game-filter-label">Trò chơi</span>
          <select class="form-select" aria-labelledby="game-filter-label" :value="game" @change="setFilter('game', ($event.target as HTMLSelectElement).value)">
            <option value="">Tất cả trò chơi</option>
            <option v-for="item in games" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>
        <label><span id="period-filter-label">Thời gian</span>
          <select class="form-select" aria-labelledby="period-filter-label" :value="period" @change="setFilter('period', ($event.target as HTMLSelectElement).value)">
            <option value="30d">30 ngày gần đây</option>
            <option value="all">Mọi thời điểm</option>
          </select>
        </label>
      </div>
      <details class="scoring">
        <summary>Cách tính điểm</summary>
        <p>Ván đấu người đã có kết quả được tính 3 điểm khi thắng, 1 khi hòa và 0 khi thua. Khi bằng điểm, thành viên có nhiều ván thắng hơn xếp trên. Cùng điểm và số ván thắng thì đồng hạng.</p>
      </details>
      <p v-if="loading" class="results-message" role="status">Đang tải bảng xếp hạng…</p>
      <div v-else-if="error" class="results-message" role="alert">
        <h2>Bảng xếp hạng chưa tải được</h2><p>{{ error }}</p>
        <button class="btn btn-quiet" type="button" @click="load">Thử lại</button>
      </div>
      <template v-else-if="board">
        <section class="personal-rank" aria-labelledby="your-position">
          <h2 id="your-position">Vị trí của bạn</h2>
          <dl v-if="board.me" class="personal-numbers">
            <div><dt>Hạng</dt><dd>#{{ points(board.me.place) }}</dd></div>
            <div><dt>Điểm</dt><dd>{{ points(board.me.points) }}</dd></div>
            <div><dt>Tỷ lệ thắng</dt><dd>{{ winRate(board.me) }}</dd></div>
          </dl>
          <p v-else>Bạn chưa có ván đấu người được tính hạng trong bộ lọc này.</p>
        </section>

        <div v-if="board.leaders.length" class="standings-table">
          <table>
            <caption>Top {{ board.leaders.length }} · {{ leaderboardScope }}</caption>
            <thead>
              <tr><th scope="col">Hạng</th><th scope="col">Thành viên</th><th scope="col" class="match-count">Ván</th><th scope="col" class="win-rate">Tỷ lệ thắng</th><th scope="col">Điểm</th></tr>
            </thead>
            <tbody>
              <tr v-for="leader in board.leaders" :key="leader.username" :class="{ 'own-row': leader.is_me }">
                <td><span class="place" :class="{ podium: leader.place <= 3 }">{{ leader.place }}</span></td>
                <th scope="row">
                  <div class="standing-member">
                    <img v-if="leader.avatar_url" :src="leader.avatar_url" width="37" height="37" loading="lazy" referrerpolicy="no-referrer" alt="">
                    <span v-else class="initial" aria-hidden="true">{{ leader.display_name.slice(0, 1).toLocaleUpperCase('vi-VN') }}</span>
                    <span class="standing-name">
                      <strong>{{ leader.display_name }}<small v-if="leader.is_me" class="self-label">Bạn</small></strong>
                      <span>@{{ leader.username }}</span>
                    </span>
                  </div>
                </th>
                <td class="match-count">{{ points(leader.played) }}</td>
                <td class="win-rate">{{ winRate(leader) }}</td>
                <td class="points">{{ points(leader.points) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="results-message"><h2>Chưa có kết quả xếp hạng</h2><p>Thử đổi trò chơi hoặc khoảng thời gian.</p></div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.scoring { padding-block: 12px; color: #c5d2c9; }
.scoring summary { cursor: pointer; color: var(--gv-primary-hover); font-weight: 700; }
.scoring p { margin: 8px 0 0; max-width: 720px; }
.personal-rank { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; border: 1px solid #d6ad6243; border-radius: 12px; background: #d6ad620c; padding: 13px 16px; margin: 6px 0 17px; }
.personal-rank h2 { margin: 0; color: #f0d398; font: 650 1.2rem 'Playfair Display', Georgia, serif; }
.personal-rank p { margin: 0; color: #c6d2c9; }
.personal-numbers { display: flex; flex-wrap: wrap; gap: 18px; margin: 0; }
.personal-numbers div { display: flex; flex-direction: column-reverse; }
.personal-numbers dt { font-size: .875rem; color: #bccac0; font-weight: 500; }
.personal-numbers dd { color: #f6daa3; font-size: 1.2rem; font-weight: 800; margin: 0; }
.standings-table { overflow-x: auto; margin-top: 12px; }
.standings-table table { width: 100%; border-collapse: collapse; text-align: left; font-variant-numeric: tabular-nums; }
.standings-table caption { caption-side: top; color: #bbcabe; padding: 0 0 10px; }
.standings-table thead { color: #bbcabe; font-size: .875rem; }
.standings-table :is(th, td) { padding: 10px 12px; border-bottom: 1px solid #ffffff18; }
.standings-table :is(th, td):last-child { text-align: right; }
.standings-table .own-row { background: #cdae6416; }
.place { min-width: 26px; height: 29px; display: inline-grid; place-items: center; text-align: center; }
.place.podium { border: 1px solid #cdae6480; border-radius: 8px; color: #f2d7a0; background: #af864529; }
.standing-member { display: flex; align-items: center; min-width: 0; gap: 10px; }
.standing-member img, .initial { width: 37px; height: 37px; flex: 0 0 auto; border-radius: 10px; object-fit: cover; background: #263e35; }
.initial { display: grid; place-items: center; color: #f2d7a0; }
.standing-name { min-width: 0; overflow-wrap: anywhere; }
.standing-name strong, .standing-name > span { display: block; }
.standing-name > span { color: #b5c7bb; font-size: .85rem; font-weight: 500; }
.self-label { display: inline-block; color: #eabd76; margin-left: 7px; font-size: .8rem; }
.points { color: #f4d599; font-weight: 800; }
@media (max-width: 620px) {
  .standings-table .win-rate { display: none; }
  .standings-table :is(th, td) { padding-inline: 6px; }
}
@media (max-width: 360px) { .standings-table .match-count { display: none; } }
</style>
