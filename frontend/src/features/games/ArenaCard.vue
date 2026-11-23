<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ card: any; selectable?: boolean; selected?: boolean }>();
const emit = defineEmits<{ pick: [] }>();
const symbols: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣', SPADE: '♠', HEART: '♥', DIAMOND: '♦', CLUB: '♣' };
const labels: Record<string, string> = { SKIP: 'Bỏ lượt', SHUFFLE: 'Xáo bài', EXPLODING: 'Mèo nổ', DEFUSE: 'Gỡ bom', REVERSE: 'Đổi chiều', DRAW_TWO: '+2', WILD_DRAW_FOUR: '+4', WILD: 'Đổi màu' };
const colors: Record<string, string> = { RED: 'đỏ', GREEN: 'xanh lá', BLUE: 'xanh dương', YELLOW: 'vàng', WILD: 'tự do' };
const mark = computed(() => symbols[props.card.suit] ?? (props.card.type ? '◈' : '✦'));
const rank = computed(() => {
  const value = props.card.type ?? props.card.label ?? props.card.rank;
  return labels[value] ?? ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[value] ?? value;
});
const tone = computed(() => props.card.type ? `uno-${props.card.color?.toLowerCase()}` : ['♥','♦'].includes(mark.value) || props.card.label === 'EXPLODING' ? 'red' : 'black');
const accessibleLabel = computed(() => `${rank.value} ${props.card.type ? colors[props.card.color] : mark.value}`);
</script>

<template>
  <component :is="selectable ? 'button' : 'span'" class="arena-card" :class="[tone, { selected }]"
    :type="selectable ? 'button' : undefined" :aria-pressed="selectable ? selected : undefined" :aria-label="accessibleLabel"
    @click="selectable && emit('pick')">
    <span class="card-corner">{{ mark }}</span>
    <strong>{{ rank }}</strong>
    <span class="card-corner end">{{ mark }}</span>
  </component>
</template>

<style scoped>
.arena-card{display:inline-flex;flex-direction:column;justify-content:space-between;align-items:center;flex:0 0 auto;width:clamp(46px,6vw,65px);aspect-ratio:2/3;padding:5px 6px;border:1px solid #e0d3b7;border-radius:8px;background:#fff6e4;color:#241e19;box-shadow:0 6px 13px #0005;line-height:1.12;vertical-align:middle}
.arena-card strong{font:800 clamp(.69rem,1.6vw,1rem)/1.08 Georgia,serif;text-align:center;overflow-wrap:anywhere}
.card-corner{align-self:flex-start;font-size:.9rem}.card-corner.end{align-self:flex-end}
.arena-card.red{color:#9c1f32}
.arena-card.uno-red,.arena-card.uno-green,.arena-card.uno-blue,.arena-card.uno-yellow,.arena-card.uno-wild{border:2px solid #f6e4ad;color:#fff9e5}
.arena-card.uno-red{background:#a8343b}.arena-card.uno-green{background:#22664d}.arena-card.uno-blue{background:#285d96}.arena-card.uno-yellow{background:#aa7421;color:#201b11}.arena-card.uno-wild{background:#4b3b57}
button.arena-card:hover,.arena-card.selected{outline:3px solid #e8c77e;outline-offset:2px;transform:translateY(-4px)}button.arena-card:focus-visible{outline:3px solid #f6e5bc;outline-offset:2px}
</style>
