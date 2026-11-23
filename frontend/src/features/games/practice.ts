import { initializeGames } from '../../../../backend/src/modules/games/core/init-games';
import { gameRegistry } from '../../../../backend/src/modules/games/core/GameRegistry';

initializeGames();

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
const playerId = (player: string | { playerId: string }) => typeof player === 'string' ? player : player.playerId;
export const PRACTICE_PLAYER = 'practice-player';

export function createPractice(gameId: string, count: number, difficulty: Difficulty) {
  const engine = gameRegistry.getEngine(gameId);
  const players = [PRACTICE_PLAYER, ...Array.from({ length: count - 1 }, (_, i) => `AI_${i + 1}`)];
  const names = ['Minh', 'An', 'Linh', 'Khánh', 'Tú'];
  const participants = players.map((id, index) => ({ id, display_name: index ? `Máy ${names[index - 1] ?? index}` : 'Bạn', is_ai: index > 0 }));
  let state = engine.initialize(players, gameId === 'WEREWOLF' ? { gameId, discussionDurationSeconds: 0 } : { gameId });
  let revision = 0;
  let log: any[] = [];

  function apply(action: any, player: string) {
    const result = engine.applyAction(state, action, player);
    state = result.newState;
    revision++;
    log = [...log, ...result.events.map((event) => ({ ...event, automated: player.startsWith('AI_') }))].slice(-30);
  }

  function runBots() {
    for (let step = 0; step < 280 && !engine.isFinished(state); step++) {
      if (gameId === 'WEREWOLF' && state.phase === 'DISCUSSION') {
        state = engine.advanceExpired?.(state) ?? state;
        revision++;
        continue;
      }
      if (gameId === 'WEREWOLF' && engine.getPublicState(state, PRACTICE_PLAYER).myAvailableActions.length) return;
      const current = state.currentPlayer || (state.currentTurnIndex === undefined ? undefined : playerId(state.players[state.currentTurnIndex]));
      const candidates = current ? [current] : players.slice(1);
      let advanced = false;
      for (const bot of candidates) {
        if (!bot.startsWith('AI_')) continue;
        const action = engine.getAiAction?.(state, bot, difficulty);
        if (!action || !engine.validateAction(state, action, bot)) continue;
        apply(action, bot);
        advanced = true;
        break;
      }
      if (!advanced) return;
    }
  }

  runBots();
  return {
    participants,
    view: () => ({ ...engine.getPublicState(state, PRACTICE_PLAYER), actionLog: log, revision }),
    finished: () => engine.isFinished(state),
    play(action: any) {
      if (!engine.validateAction(state, action, PRACTICE_PLAYER)) throw new Error('Nước đi này chưa hợp lệ.');
      apply(action, PRACTICE_PLAYER);
      runBots();
    },
  };
}
