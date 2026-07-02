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
    super(x, y, 100);
    this.id = id;
    this.speed = CFG.OPERATOR_SPEED;
    this.selected = false;
  }
}
