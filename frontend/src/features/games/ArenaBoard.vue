<script setup lang="ts">
import { computed, ref, watch } from 'vue';

type Point = { row: number; column: number };
type Move = { from: Point; to: Point; promotion?: string };
type Piece = { type: string; color: string } | null;
const props = defineProps<{ gameId: string; state: any; busy: boolean }>();
const emit = defineEmits<{ action: [action: { type: string; payload: Record<string, unknown> }] }>();
const selected = ref<Point>();
const promote = ref<Move[]>([]);
const legalMoves = computed<Move[]>(() => props.state.legalMoves || []);
const xiangqi = computed(() => props.gameId === 'CO_TUONG');
const columns = computed(() => xiangqi.value ? 9 : 8);
const points = computed(() => (props.state.board || []).flatMap((row: Piece[], r: number) => row.map((piece, c) => ({ piece, row: r, column: c }))));
const matches = (left: Point | undefined, right: Point) => left?.row === right.row && left?.column === right.column;
const targets = computed(() => legalMoves.value.filter((move) => matches(selected.value, move.from)));
const levels: Record<string, string> = { QUEEN: 'Hậu', ROOK: 'Xe', BISHOP: 'Tượng', KNIGHT: 'Mã' };
const labels: Record<string, string> = { ...levels, KING: 'Tướng', PAWN: 'Tốt', ELEPHANT: 'Tượng', ADVISOR: 'Sĩ', CANNON: 'Pháo' };

function glyph(piece: Piece) {
  if (!piece) return '';
  if (xiangqi.value) {
    const red = piece.color === 'RED';
    return ({ KING: red ? '帥' : '將', ROOK: red ? '俥' : '車', KNIGHT: '馬', PAWN: red ? '兵' : '卒',
      ELEPHANT: red ? '相' : '象', ADVISOR: red ? '仕' : '士', CANNON: red ? '炮' : '砲' } as Record<string, string>)[piece.type];
  }
  return ({ KING: '♚', QUEEN: '♛', ROOK: '♜', BISHOP: '♝', KNIGHT: '♞', PAWN: '♟' } as Record<string, string>)[piece.type];
}

function choose(point: Point) {
  if (props.busy) return;
  const choices = targets.value.filter((move) => matches(move.to, point));
  if (choices.length > 1) {
    promote.value = choices;
    return;
  }
  if (choices[0]) send(choices[0]);
  else selected.value = !matches(selected.value, point) && legalMoves.value.some((move) => matches(move.from, point)) ? point : undefined;
}

function send(move: Move) {
  const { from, to, promotion } = move;
  selected.value = undefined;
  promote.value = [];
  emit('action', { type: 'MOVE', payload: { from, to, promotion } });
}

watch(() => props.state.revision, () => { selected.value = undefined; promote.value = []; });
</script>

<template>
  <div class="board-frame">
    <p v-if="state.checked && state.phase !== 'FINISHED'" class="in-check" role="status">Đang bị chiếu</p>
    <div class="grid-board" :class="{ xiangqi }" :style="{ '--columns': columns }" :aria-label="xiangqi ? 'Bàn cờ tướng' : 'Bàn cờ vua'">
      <button v-for="point in points" :key="`${point.row}-${point.column}`"
        class="board-cell" :class="[{ dark: (point.row + point.column) % 2, selected: matches(selected, point), target: targets.some((move) => matches(move.to, point)) }, point.piece?.color.toLowerCase()]"
        :disabled="busy || !legalMoves.length"
        :aria-pressed="matches(selected, point)"
        :aria-label="`${'abcdefghi'[point.column]}${(xiangqi ? 10 : 8) - point.row}${point.piece ? ' · ' + (point.piece.type === 'KING' && !xiangqi ? 'Vua' : labels[point.piece.type]) + ' ' + ({ WHITE: 'trắng', BLACK: 'đen', RED: 'đỏ', BLACK_SIDE: 'đen' })[point.piece.color as 'WHITE'] : ''}`"
        @click="choose(point)">
        <span v-if="point.piece" class="piece" aria-hidden="true">{{ glyph(point.piece) }}</span>
        <small v-if="point.row === (xiangqi ? 9 : 7)" aria-hidden="true">{{ 'abcdefghi'[point.column] }}</small>
      </button>
    </div>
    <div v-if="promote.length" class="promotion">
      <strong>Phong cấp tốt</strong>
      <button v-for="move in promote" :key="move.promotion" class="btn btn-gold" @click="send(move)">{{ levels[move.promotion!] }}</button>
      <button class="btn btn-quiet" @click="promote = []">Hủy</button>
    </div>
  </div>
</template>

<style scoped>
.board-frame{width:min(100%,560px);margin:0 auto;position:relative}
.grid-board{display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));border:5px solid #755134;border-radius:7px;overflow:hidden;box-shadow:0 15px 34px #0006;padding:0;background:#a47750}
.board-cell{aspect-ratio:1;border:0;background:#eed7ac;color:#241b13;display:grid;place-items:center;position:relative;min-width:0;line-height:1}
.board-cell.dark{background:#ae794e}.board-cell:disabled{opacity:1}
.board-cell.selected{outline:3px solid #e9eea4;outline-offset:-3px;background:#859555}
.board-cell.target::after{content:'';position:absolute;width:25%;aspect-ratio:1;border-radius:50%;background:#244a33a8}
.board-cell.target:has(.piece)::after{width:85%;background:transparent;border:4px solid #577751}
.board-cell small{position:absolute;bottom:2px;left:3px;font:700 .65rem sans-serif;opacity:.65}
.piece{font-family:'DejaVu Sans','Segoe UI Symbol',serif;font-size:clamp(1.5rem,4vw,3.5rem);line-height:1}
.white .piece{color:#fff5db;-webkit-text-stroke:1px #483327;text-shadow:0 2px 2px #3e241d80}
.xiangqi .board-cell{background:#d3a86f;border:1px solid #916d49}
.xiangqi .piece{display:grid;place-items:center;width:82%;aspect-ratio:1;border:2px solid currentColor;border-radius:50%;background:#ffe7ba;font:700 clamp(.9rem,3.3vw,1.85rem) Georgia,serif;box-shadow:0 2px 3px #5e3d3780}
.xiangqi .red .piece{color:#961c26}
.board-cell:focus-visible{z-index:2;outline:3px solid #1d572f;outline-offset:-3px}
.in-check{margin:0 0 8px;color:#ffdd99;font-weight:800;text-align:center}
.promotion{position:absolute;inset:30% 8% auto;display:flex;flex-wrap:wrap;justify-content:center;gap:7px;background:#101817;padding:16px;border:1px solid #e7c98c;border-radius:14px;box-shadow:0 12px 35px #0008}
.promotion strong{width:100%;text-align:center;margin-bottom:5px}
</style>
