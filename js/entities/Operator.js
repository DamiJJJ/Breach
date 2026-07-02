import { Entity } from './Entity.js';
import { CFG } from '../core/Config.js';

/**
 * Operator — jednostka gracza. Interpoluje pozycję po waypointach w world px
 * (ścieżkę liczy i wstawia z zewnątrz InputHandler/CommandSystem — encja
 * nie zna pathfindingu).
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
    /** @type {{x:number,y:number}[]} waypointy w world px */
    this.path = [];
  }

  /** @param {{x:number,y:number}[]|null} waypoints */
  setPath(waypoints) {
    this.path = waypoints ?? [];
  }

  update(dt) {
    let remaining = this.speed * dt;
    while (remaining > 0 && this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - this.x;
      const dy = wp.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1e-6) this.direction = Math.atan2(dy, dx);

      if (dist <= remaining) {
        this.x = wp.x;
        this.y = wp.y;
        this.path.shift();
        remaining -= dist;
      } else {
        this.x += (dx / dist) * remaining;
        this.y += (dy / dist) * remaining;
        remaining = 0;
      }
    }
  }
}
