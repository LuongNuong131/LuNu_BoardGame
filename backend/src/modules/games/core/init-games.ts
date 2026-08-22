import { gameRegistry } from './GameRegistry';
import { UnoEngine } from '../uno/UnoEngine';

export function initializeGames() {
  gameRegistry.register('UNO', new UnoEngine());
}