import type { GameEngine } from './GameEngine';
import { AppError } from '../../../shared/errors/AppError';

class GameRegistry {
  private engines: Map<string, GameEngine<any, any, any>> = new Map();

  register(gameId: string, engine: GameEngine<any, any, any>) {
    this.engines.set(gameId, engine);
  }

  getEngine(gameId: string): GameEngine<any, any, any> {
    const engine = this.engines.get(gameId);
    if (!engine) {
      throw new AppError(500, 'ENGINE_NOT_FOUND', `Engine cho game ${gameId} chưa được tích hợp.`);
    }
    return engine;
  }
}

// Singleton Pattern để dùng chung toàn server
export const gameRegistry = new GameRegistry();