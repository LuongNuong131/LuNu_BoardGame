import { TienLenCard, TienLenCombination, TienLenCombinationType, TienLenRuleset, cardValue, rankValue } from './tien-len.types';

export class CombinationEngine {
  evaluate(cards: TienLenCard[], ruleset: TienLenRuleset): TienLenCombination {
    const sorted = [...cards].sort((a, b) => cardValue(a, ruleset) - cardValue(b, ruleset));
    if (!sorted.length) return { isValid: false, length: 0 };
    const ranks = sorted.map((card) => rankValue(card.rank));
    const sameRank = ranks.every((rank) => rank === ranks[0]);
    let combinationType: TienLenCombinationType | undefined;
    if (sorted.length === 1) combinationType = 'SINGLE';
    else if (sorted.length === 2 && sameRank) combinationType = 'PAIR';
    else if (sorted.length === 3 && sameRank) combinationType = 'TRIPLE';
    else if (sorted.length === 4 && sameRank) combinationType = 'FOUR_OF_A_KIND';
    else if (ruleset.allowStraight && sorted.length >= 3 && new Set(ranks).size === sorted.length && !ranks.includes(15) && ranks.every((rank, index) => index === 0 || rank === ranks[index - 1] + 1)) combinationType = 'STRAIGHT';
    if (!combinationType) return { isValid: false, length: sorted.length };
    return { isValid: true, combinationType, rank: ranks[ranks.length - 1], highestCard: sorted[sorted.length - 1], length: sorted.length, suit: sorted[sorted.length - 1].suit, metadata: { cards: sorted.map((card) => card.cardId) } };
  }
  canBeat(current: TienLenCombination | undefined, next: TienLenCombination, ruleset: TienLenRuleset): boolean {
    if (!next.isValid) return false;
    if (!current) return true;
    if (next.combinationType === current.combinationType && next.length === current.length) return (next.rank || 0) > (current.rank || 0);
    if (ruleset.allowFourToBeatTwo && next.combinationType === 'FOUR_OF_A_KIND' && current.combinationType === 'PAIR' && current.rank === 15) return true;
    return false;
  }
}
