<script setup lang="ts">
import { computed, ref } from 'vue';
import { GAME_CATALOG } from '@/data/games';

const filters = [
  { id: 'all', label: 'Tất cả', icon: 'bi-grid' },
  { id: 'board', label: 'Bàn cờ', icon: 'bi-grid-3x3' },
  { id: 'cards', label: 'Bàn bài', icon: 'bi-suit-spade' },
  { id: 'social', label: 'Chơi nhóm', icon: 'bi-people' },
] as const;
const category = ref<string>('all');
const search = ref('');
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{Mark}/gu, '').replace(/đ/g, 'd');
const games = computed(() => GAME_CATALOG.filter((game) =>
  (category.value === 'all' || game.category === category.value) && normalize(game.name).includes(normalize(search.value.trim()))));
</script>

<template>
  <main class="practice-lobby">
    <nav class="practice-nav">
      <RouterLink to="/practice" class="practice-brand" aria-label="LuNu Board Game Club">
        <i class="bi bi-diamond-half" aria-hidden="true"></i>
        <span><strong>LuNu</strong><small>Board Game Club</small></span>
      </RouterLink>
      <RouterLink to="/rooms" class="member-link">Sảnh trực tuyến</RouterLink>
    </nav>

    <div class="practice-content">
      <section class="practice-hero">
        <div class="hero-copy">
          <p class="kicker">Câu lạc bộ LuNu</p>
          <h1>Sảnh luyện tập</h1>
          <p>Thử chiến thuật mới và luyện cùng máy ở {{ GAME_CATALOG.length }} bàn cờ, bàn bài và trò chơi nhóm.</p>
          <RouterLink to="/game/demo-chess" class="practice-gold"><i class="bi bi-play-fill" aria-hidden="true"></i> Bắt đầu với cờ vua</RouterLink>
        </div>
      </section>

      <section class="practice-catalog" aria-labelledby="practice-title">
        <div class="catalog-heading">
          <div><h2 id="practice-title">Chọn bàn chơi</h2><p>{{ games.length }} trò chơi</p></div>
          <label class="practice-search"><i class="bi bi-search" aria-hidden="true"></i><input v-model="search" aria-label="Tìm trò chơi" placeholder="Tìm trò chơi..."></label>
        </div>
        <div class="practice-filters" aria-label="Thể loại">
          <button v-for="filter in filters" :key="filter.id" type="button" :aria-pressed="category === filter.id" @click="category = filter.id">
            <i :class="`bi ${filter.icon}`" aria-hidden="true"></i> {{ filter.label }}
          </button>
        </div>
        <div v-if="games.length" class="practice-grid">
          <RouterLink v-for="game in games" :key="game.id" :to="`/game/demo-${game.id.toLowerCase()}`"
            class="practice-card" :style="{ '--game-accent': game.accent }">
            <div class="game-medallion"><i :class="`bi ${game.icon}`" aria-hidden="true"></i></div>
            <div><h3>{{ game.name }}</h3><p>{{ game.description }}</p></div>
            <div class="card-detail"><span><i class="bi bi-people" aria-hidden="true"></i> {{ game.players }}</span><strong>Vào bàn</strong></div>
          </RouterLink>
        </div>
        <p v-else class="no-games">Không tìm thấy trò chơi phù hợp.</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.practice-lobby{min-height:100vh;background:#090f0e;color:#f8f2e6;font-family:'Manrope',sans-serif}
.practice-nav{max-width:1376px;margin:auto;padding:20px clamp(18px,5vw,70px);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ffffff13}
.practice-brand{display:flex;align-items:center;gap:13px;color:#f3e9d4;text-decoration:none}
.practice-brand i{font-size:1.35rem;color:#e9c580}.practice-brand strong,.practice-brand small{display:block}.practice-brand strong{font:700 1.45rem Georgia,serif;line-height:1}.practice-brand small{font-size:.75rem;color:#b8beb2;margin-top:4px}
.member-link{border:1px solid #d5ae6660;border-radius:999px;padding:10px 17px;color:#f0d39c;font-weight:700;text-decoration:none}
.practice-content{max-width:1376px;margin:auto;padding:32px clamp(18px,5vw,70px) 60px}
.practice-hero{display:flex;align-items:center;min-height:390px;background:linear-gradient(90deg,#10221e 4%,#10221eea 31%,#10191652 64%,#0e151408),url('@/assets/boardgame-hero.webp') right 54%/cover no-repeat;border:1px solid #d4b77b4d;border-radius:24px;overflow:hidden}
.hero-copy{width:min(100%,595px);padding:clamp(22px,5vw,64px)}
.kicker{color:#e7c487;text-transform:uppercase;font-size:.82rem;font-weight:800;letter-spacing:.17em}
.hero-copy h1{font:600 clamp(2.8rem,6vw,5.2rem)/1.02 'Playfair Display',Georgia,serif;letter-spacing:-.055em;margin:8px 0 20px;text-wrap:balance}
.hero-copy>p:not(.kicker){font-size:1.05rem;line-height:1.65;max-width:360px;color:#e3e4d8;margin-bottom:25px}
.practice-gold{display:inline-flex;align-items:center;gap:7px;border-radius:10px;background:#edca86;color:#211b12;font-weight:800;text-decoration:none;padding:12px 19px}.practice-gold:hover{background:#ffe1a7;color:#211b12}
.practice-catalog{margin-top:42px}.catalog-heading{display:flex;justify-content:space-between;align-items:end;gap:15px}.catalog-heading h2{font:600 clamp(1.9rem,4vw,2.6rem) 'Playfair Display',Georgia,serif;margin:0}.catalog-heading p{color:#b2bfb5;margin:6px 0 0}
.practice-search{display:flex;align-items:center;gap:10px;color:#b2bfb5;background:#131d19;padding:10px 13px;border:1px solid #ffffff21;border-radius:9px}.practice-search input{background:transparent;color:#f8f2e6;border:0;min-width:0;width:190px}.practice-search:focus-within{outline:2px solid #e0be7f}.practice-search input:focus{outline:0}
.practice-filters{display:flex;flex-wrap:wrap;gap:8px;margin:19px 0}.practice-filters button{border:1px solid #ffffff25;border-radius:999px;padding:8px 14px;background:#131d19;color:#d2d9d0}.practice-filters button[aria-pressed=true]{border-color:#ddba79;background:#dfbd7c;color:#231e13}.practice-filters i{margin-right:3px}
.practice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:13px}
.practice-card{display:grid;grid-template-rows:auto 1fr auto;gap:14px;padding:19px;border:1px solid #ffffff1a;border-radius:14px;color:#f5efdf;text-decoration:none;background:linear-gradient(150deg,color-mix(in srgb,var(--game-accent) 12%,#111916),#111916 60%);transition:border-color .2s,transform .2s}
.practice-card:hover{color:#fff4de;border-color:var(--game-accent);transform:translateY(-3px)}.game-medallion{width:42px;height:42px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--game-accent) 40%,transparent);border-radius:12px;color:var(--game-accent);font-size:1.2rem}
.practice-card h3{font:700 1.28rem Georgia,serif;margin:0 0 6px}.practice-card p{color:#bdc9bf;font-size:.9rem;line-height:1.55;margin:0}.card-detail{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px solid #ffffff16;padding-top:13px;font-size:.88rem;color:#bcc8bc}.card-detail strong{color:var(--game-accent)}.no-games{padding:24px;background:#131d19;border-radius:12px}
@media(max-width:620px){.catalog-heading{align-items:stretch;flex-direction:column}.practice-search input{width:100%}.practice-hero{background-position:65% center;min-height:325px}.hero-copy{background:linear-gradient(90deg,#101f1cf5,#101f1c80);min-height:325px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.member-link{font-size:.86rem}}
@media(prefers-reduced-motion:reduce){.practice-card{transition:none}}
</style>
