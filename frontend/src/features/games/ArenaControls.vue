<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ArenaCard from './ArenaCard.vue';

const props = defineProps<{ gameId: string; state: any; playerId: string; busy: boolean; finished: boolean; isPlayer: boolean; nameOf: (id: string) => string }>();
const emit = defineEmits<{ action: [action: any] }>();
const selected = ref<string[]>([]);
const chosenColor = ref('RED');
const sayUno = ref(false);
const groups = ref<string[][]>([[], [], []]);
const groupIndex = ref(0);
const bet = ref<number>();
const reinsertion = ref<number>();
const target = ref('');

const hand = computed<any[]>(() => props.state.myHand ?? props.state.ownCards ?? []);
const id = (card: any): string => card.id ?? card.cardId;
const active = computed(() => props.isPlayer && !props.finished && !props.busy);
const actions = computed<string[]>(() => {
  if (!active.value) return [];
  if (props.gameId === 'WEREWOLF') return props.state.myAvailableActions || [];
  if (props.gameId === 'TIEN_LEN') return props.state.currentPlayer === props.playerId ? ['PLAY_CARDS', ...(props.state.lastPlay ? ['PASS'] : [])] : [];
  return props.state.availableActions || [];
});
const has = (type: string) => actions.value.includes(type);
const boardGame = computed(() => ['CHESS', 'CO_TUONG'].includes(props.gameId));
const cardGame = computed(() => ['UNO', 'TIEN_LEN', 'PHOM', 'EXPLODING_KITTENS', 'MAU_BINH'].includes(props.gameId));
const canSelect = (card: any) => {
  if (!active.value || !cardGame.value || !actions.value.length) return false;
  if (props.gameId === 'UNO') return props.state.playableCards?.includes(id(card));
  if (props.gameId === 'EXPLODING_KITTENS') return has('PLAY_CARD') && ['SKIP', 'SHUFFLE'].includes(card.label);
  if (props.gameId === 'PHOM') return !props.state.myPhomMelds?.flat().includes(id(card));
  return true;
};
const isSelected = (card: any) => selected.value.includes(id(card)) || groups.value.some((group) => group.includes(id(card)));
const wild = computed(() => hand.value.some((card) => id(card) === selected.value[0] && card.color === 'WILD'));
const targets = computed(() => (props.state.players || []).filter((p: any) => p.alive &&
  (p.playerId !== props.playerId || has('GUARD_PROTECT')) && (!has('WEREWOLF_KILL') || p.roleId !== 'werewolf')));
const options = computed(() => props.state.bettingOptions);
const validBet = computed(() => typeof bet.value === 'number' && Number.isSafeInteger(bet.value) && bet.value >= options.value?.min && bet.value <= options.value?.max);
const cities = computed<any[]>(() => props.state.cityCells || []);
const tile = computed(() => cities.value[props.state.positions?.[props.playerId]]);
const colors = [
  { id: 'RED', name: 'Đỏ' }, { id: 'GREEN', name: 'Xanh lá' }, { id: 'BLUE', name: 'Xanh dương' }, { id: 'YELLOW', name: 'Vàng' },
];
const labels: Record<string, string> = {
  HIT: 'Rút thêm', STAND: 'Dừng bài', DRAW_CARD: 'Rút bài', PASS: 'Bỏ lượt', FOLD: 'Úp bài', CHECK: 'Nhường cược',
  DEFUSE: 'Gỡ bom', SUBMIT_HAND: 'Chốt bài', ROLL_DICE: 'Tung xúc xắc', END_TURN: 'Kết thúc lượt',
  WEREWOLF_KILL: 'Săn đêm', SEER_CHECK: 'Soi người này', GUARD_PROTECT: 'Bảo vệ', WITCH_HEAL: 'Dùng thuốc cứu',
  WITCH_POISON: 'Dùng thuốc độc', CAST_VOTE: 'Bỏ phiếu', SKIP_VOTE: 'Bỏ qua phiếu', SKIP_NIGHT: 'Bỏ qua lượt đêm',
  HUNTER_SHOOT: 'Bắn', CONFIRM_LAST_WORD: 'Kết thúc lời cuối',
};
const targetActions = ['WEREWOLF_KILL', 'SEER_CHECK', 'GUARD_PROTECT', 'WITCH_POISON', 'CAST_VOTE', 'HUNTER_SHOOT'];
const simple = computed(() => actions.value.filter((type) =>
  !['MOVE', 'CALL', 'BET', 'RAISE', 'BUY', 'UPGRADE', 'MOVE_HORSE', 'PLAY_CARD', 'PLAY_CARDS', 'DISCARD', 'TAKE_DISCARD', 'DEFUSE'].includes(type) &&
  !(type === 'SUBMIT_HAND' && props.gameId === 'MAU_BINH')));
const selectedCardId = computed(() => selected.value[0]);

watch(() => props.state.revision, () => {
  selected.value = selected.value.filter((cardId) => hand.value.some((card) => id(card) === cardId));
  if (options.value) bet.value = options.value.min;
  target.value = '';
}, { immediate: true });

function selectCard(card: any) {
  const cardId = id(card);
  if (props.gameId === 'MAU_BINH') {
    const existing = groups.value.findIndex((group) => group.includes(cardId));
    if (existing >= 0) groups.value[existing] = groups.value[existing]!.filter((item) => item !== cardId);
    else if (groups.value[groupIndex.value]!.length < [3, 5, 5][groupIndex.value]!) groups.value[groupIndex.value]!.push(cardId);
    return;
  }
  if (selected.value.includes(cardId)) selected.value = selected.value.filter((item) => item !== cardId);
  else if (props.gameId === 'TIEN_LEN' || (props.gameId === 'PHOM' && has('TAKE_DISCARD'))) selected.value.push(cardId);
  else selected.value = [cardId];
}

function send(type: string, payload: Record<string, unknown> = {}) {
  if (props.gameId === 'TIEN_LEN') emit('action', { type, cardIds: selected.value.slice() });
  else if (props.gameId === 'WEREWOLF') emit('action', { type, targetPlayerId: target.value || undefined });
  else emit('action', { type, payload });
}
</script>

<template>
  <section class="control-panel">
    <div class="control-heading"><h2>{{ isPlayer && hand.length ? 'Tay bài của bạn' : 'Hành động' }}</h2><span v-if="hand.length">{{ hand.length }} lá</span></div>
    <p v-if="!isPlayer">Bạn đang theo dõi ván đấu.</p>
    <p v-else-if="finished">Ván chơi đã kết thúc.</p>
    <p v-else-if="busy">Đang xử lý nước đi…</p>
    <p v-else-if="!actions.length">Đang chờ người chơi khác.</p>
    <p v-else-if="boardGame">Chọn quân, sau đó chọn một trong các ô đích được đánh dấu.</p>
    <p v-else-if="gameId === 'TIEN_LEN' && state.turnNumber === 1 && state.openingCardId">Nước mở màn cần có lá {{ state.openingCardId }}.</p>
    <p v-else-if="gameId === 'PHOM' && has('TAKE_DISCARD')">Chọn hai lá tạo phỏm với lá bài trên bàn, hoặc rút từ nọc.</p>
    <p v-else-if="gameId === 'MAU_BINH'">Chọn một chi rồi chọn các lá để xếp. Bấm lại vào lá để bỏ khỏi chi.</p>
    <p v-else-if="gameId === 'EXPLODING_KITTENS' && !has('DEFUSE')">Rút bài hoặc chọn lá Xáo bài hay Bỏ lượt để sử dụng.</p>

    <div v-if="gameId === 'MAU_BINH' && isPlayer && !finished" class="group-grid" aria-label="Chọn chi để xếp">
      <button v-for="(group, index) in groups" :key="index" class="btn btn-quiet" :aria-pressed="groupIndex === index" @click="groupIndex = index">
        {{ ['Đầu', 'Giữa', 'Cuối'][index] }} {{ group.length }}/{{ [3, 5, 5][index] }}
        <small v-if="group.length">{{ group.map((cardId) => hand.find((card) => id(card) === cardId)?.label).join(' · ') }}</small>
      </button>
    </div>
    <div v-if="hand.length" class="arena-hand">
      <ArenaCard v-for="card in hand" :key="id(card)" :card="card" :selectable="canSelect(card)" :selected="isSelected(card)" @pick="selectCard(card)" />
    </div>
    <p v-if="state.myTotal !== undefined" class="total">Điểm tay bài <strong>{{ state.myTotal }}</strong></p>

    <template v-if="actions.length">
      <label v-if="gameId === 'WEREWOLF' && actions.some((type) => targetActions.includes(type))" class="field">Chọn người chơi
        <select v-model="target"><option value="">Chọn mục tiêu</option><option v-for="p in targets" :key="p.playerId" :value="p.playerId">{{ nameOf(p.playerId) }}</option></select>
      </label>
      <div v-if="state.threatenedId && has('WITCH_HEAL')" class="werewolf-clue">{{ nameOf(state.threatenedId) }} đang gặp nguy hiểm.</div>
      <label v-if="gameId === 'UNO' && wild" class="field">Chọn màu
        <select v-model="chosenColor"><option v-for="color in colors" :key="color.id" :value="color.id">{{ color.name }}</option></select>
      </label>
      <label v-if="gameId === 'UNO' && hand.length === 2" class="check-line"><input v-model="sayUno" type="checkbox"> Hô UNO khi đánh bài</label>
      <label v-if="has('DEFUSE')" class="field">Vị trí cài lại, 0 là đầu nọc
        <input v-model.number="reinsertion" type="number" :min="0" :max="state.deckCount" placeholder="Ngẫu nhiên">
      </label>
      <div v-if="has('RAISE') || has('BET')" class="bet-input">
        <label class="field">Tổng mức cược ở vòng này
          <input v-model.number="bet" type="number" :min="options.min" :max="options.max" step="1">
        </label>
        <button class="btn btn-gold" :disabled="!validBet" @click="send(has('BET') ? 'BET' : 'RAISE', { amount: bet })">{{ has('BET') ? 'Đặt cược' : 'Tố' }}</button>
      </div>
      <div class="table-actions">
        <button v-if="(gameId === 'UNO' && state.playableCards?.length) || has('PLAY_CARD')" class="btn btn-gold" :disabled="!selectedCardId" @click="send('PLAY_CARD', { cardId: selectedCardId, chosenColor: wild ? chosenColor : undefined, sayUno })">Đánh lá đã chọn</button>
        <button v-if="has('PLAY_CARDS')" class="btn btn-gold" :disabled="!selected.length" @click="send('PLAY_CARDS')">Đánh {{ selected.length ? selected.length + ' lá' : 'bài' }}</button>
        <button v-if="has('DISCARD')" class="btn btn-gold" :disabled="!selectedCardId" @click="send('DISCARD', { cardId: selectedCardId })">Đánh lá rác</button>
        <button v-if="has('TAKE_DISCARD')" class="btn btn-gold" :disabled="selected.length !== 2" @click="send('TAKE_DISCARD', { cardIds: selected.slice() })">Ăn lá trên bàn</button>
        <button v-if="gameId === 'MAU_BINH' && has('SUBMIT_HAND')" class="btn btn-gold" :disabled="groups.flat().length !== 13" @click="send('SUBMIT_HAND', { groups: groups.map((group) => group.slice()) })">Chốt ba chi</button>
        <button v-if="has('DEFUSE')" class="btn btn-gold" @click="send('DEFUSE', { index: typeof reinsertion === 'number' ? reinsertion : undefined })">Gỡ bom</button>
        <button v-if="has('CALL')" class="btn btn-gold" @click="send('CALL')">Theo {{ options.due }} chip</button>
        <button v-if="has('BUY')" class="btn btn-gold" @click="send('BUY')">Mua {{ tile?.name }} · {{ tile?.price }} xu</button>
        <button v-if="has('UPGRADE')" class="btn btn-gold" @click="send('UPGRADE')">Nâng cấp · {{ Math.floor((tile?.price ?? 0) / 2) }} xu</button>
        <button v-for="move in state.horseMoves || []" :key="move.index" class="btn btn-gold" @click="send('MOVE_HORSE', { index: move.index })">Đi quân {{ move.index + 1 }}</button>
        <button v-for="type in simple" :key="type" class="btn btn-quiet" :disabled="targetActions.includes(type) && !target" @click="send(type)">{{ labels[type] || type }}</button>
      </div>
    </template>
    <dl v-if="gameId === 'WEREWOLF' && Object.keys(state.mySight || {}).length" class="sight">
      <template v-for="(team, player) in state.mySight" :key="player"><dt>{{ nameOf(String(player)) }}</dt><dd>{{ team === 'WEREWOLF' ? 'Phe Sói' : 'Phe Làng' }}</dd></template>
    </dl>
  </section>
</template>

<style scoped>
.control-panel{padding:21px;border:1px solid #d9e9d624;border-radius:17px;background:#111d1a}
.control-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px}.control-heading h2{font:600 1.25rem Georgia,serif;margin:0}.control-heading span,.control-panel p{color:#b5c4b9;margin:0 0 8px}.control-heading span{margin:0;font-size:.88rem}
.arena-hand,.table-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}
.table-actions .btn,.bet-input .btn{white-space:normal;min-height:42px}
.field{display:flex;flex-direction:column;gap:6px;margin:11px 0;font-size:.9rem;color:#c5cdc2}
.field select,.field input{width:100%;min-height:42px;border:1px solid #adbeaf49;border-radius:7px;background:#0a1512;color:#f0ead8;padding:7px 9px}
.check-line{display:flex;align-items:center;gap:9px;margin-top:14px}.check-line input{accent-color:#e0b871}
.bet-input{display:flex;align-items:end;gap:8px}.bet-input .field{margin-bottom:0;flex:1}
.group-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:12px 0}.group-grid .btn{min-height:46px}.group-grid small{display:block;font-size:.72rem}.group-grid [aria-pressed=true]{border-color:#e0b871;color:#f9dfa8}
.total{margin-top:10px!important}.total strong{color:#f0d196;padding-left:4px}
.sight{display:grid;grid-template-columns:1fr auto;margin:12px 0 0;padding-top:8px;border-top:1px solid #ffffff20}.sight dd{color:#f2d198}.werewolf-clue{color:#f2cdb0}
</style>
