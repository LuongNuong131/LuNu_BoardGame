import { CatalogGameEngine } from './CatalogGameEngine';
import { WerewolfEngine as ServerWerewolfEngine } from '../werewolf/WerewolfEngine';
import { TienLenEngine as ServerTienLenEngine } from '../tien-len/TienLenEngine';

export { ServerWerewolfEngine as WerewolfEngine };
export { ServerTienLenEngine as TienLenEngine };
export class BlackjackEngine extends CatalogGameEngine { constructor() { super('BLACKJACK'); } }
export class PhomEngine extends CatalogGameEngine { constructor() { super('PHOM'); } }
export class XiDachEngine extends CatalogGameEngine { constructor() { super('XI_DACH'); } }
export class PokerEngine extends CatalogGameEngine { constructor() { super('POKER'); } }
export class MauBinhEngine extends CatalogGameEngine { constructor() { super('MAU_BINH'); } }
export class BaoCaoEngine extends CatalogGameEngine { constructor() { super('BAO_CAO'); } }
export class LiengEngine extends CatalogGameEngine { constructor() { super('LIENG'); } }
export class ChessEngine extends CatalogGameEngine { constructor() { super('CHESS'); } }
export class ChineseChessEngine extends CatalogGameEngine { constructor() { super('CO_TUONG'); } }
export class LudoEngine extends CatalogGameEngine { constructor() { super('CO_CA_NGUA'); } }
export class MonopolyEngine extends CatalogGameEngine { constructor() { super('CO_TY_PHU'); } }
export class ExplodingKittensEngine extends CatalogGameEngine { constructor() { super('EXPLODING_KITTENS'); } }
