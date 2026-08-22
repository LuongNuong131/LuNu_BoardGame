import { gameRegistry } from './GameRegistry';
import { UnoEngine } from '../uno/UnoEngine';
import {
  BaoCaoEngine, BlackjackEngine, ChessEngine, ChineseChessEngine, ExplodingKittensEngine, LiengEngine,
  LudoEngine, MauBinhEngine, MonopolyEngine, PhomEngine, PokerEngine, TienLenEngine, WerewolfEngine, XiDachEngine
} from '../catalog/CatalogEngines';

export function initializeGames() {
  gameRegistry.register('UNO', new UnoEngine());
  gameRegistry.register('WEREWOLF', new WerewolfEngine());
  gameRegistry.register('TIEN_LEN', new TienLenEngine());
  gameRegistry.register('BLACKJACK', new BlackjackEngine());
  gameRegistry.register('PHOM', new PhomEngine());
  gameRegistry.register('XI_DACH', new XiDachEngine());
  gameRegistry.register('POKER', new PokerEngine());
  gameRegistry.register('MAU_BINH', new MauBinhEngine());
  gameRegistry.register('BAO_CAO', new BaoCaoEngine());
  gameRegistry.register('LIENG', new LiengEngine());
  gameRegistry.register('CHESS', new ChessEngine());
  gameRegistry.register('CO_TUONG', new ChineseChessEngine());
  gameRegistry.register('CO_CA_NGUA', new LudoEngine());
  gameRegistry.register('CO_TY_PHU', new MonopolyEngine());
  gameRegistry.register('EXPLODING_KITTENS', new ExplodingKittensEngine());
}
