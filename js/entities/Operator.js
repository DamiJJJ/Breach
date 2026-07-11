import { Entity } from './Entity.js';
import { CFG } from '../core/Config.js';

/**
 * Operator — jednostka gracza. Interpoluje pozycję po waypointach w world px
 * (ścieżkę liczy i wstawia z zewnątrz InputHandler/CommandSystem — encja
 * nie zna pathfindingu). Ruch po ścieżce dziedziczy z Entity.
 */
export class Operator extends Entity {
  /**
   * @param {number} x world px
   * @param {number} y world px
   * @param {number} id
   */
  constructor(x, y, id) {
    super(x, y, CFG.OPERATOR_HP);
    this.id = id;
    this.speed = CFG.OPERATOR_SPEED;
    this.selected = false;
    /**
     * Bieżący rozkaz na drzwiach (tylko dane — wykonuje DoorSystem).
     * @type {{door: import('./Door.js').Door, type: 'OPEN_SLOW'|'KICK', timer: number}|null}
     */
    this.doorAction = null;
    /**
     * Kolejka rozkazów na ścieżce (tylko dane — buduje i wykonuje CommandSystem).
     * @type {import('../systems/CommandSystem.js').OrderNode[]}
     */
    this.orders = [];
    /**
     * Slot gadżetu (brief #9) — przydziela Game ze spawnu mapy; użycia
     * zdejmują GadgetSystem (flashbang) i DoorSystem (breach charge).
     * @type {{type:'FLASHBANG'|'BREACH_CHARGE', uses:number}|null}
     */
    this.gadget = null;
  }
}
