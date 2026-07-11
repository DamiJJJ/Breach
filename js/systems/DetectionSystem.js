import { CFG } from '../core/Config.js';
import { angleDiff, degToRad } from '../core/MathUtils.js';

/**
 * Percepcja wrogów: stożek widzenia (LOS_FOV_DEG / LOS_RANGE) + linia
 * widzenia po losMask (okno przepuszcza — wróg widzi przez okno, ściana
 * i zamknięte drzwi blokują). Wykrycie jest natychmiastowe i propaguje
 * alarm do wrogów w promieniu ALERT_RADIUS_TILES.
 *
 * Wołany PO ruchu (Movement) — pracuje na aktualnych pozycjach klatki.
 */
export class DetectionSystem {
  /** @param {{map: import('../map/MapData.js').MapData}} deps */
  constructor({ map }) {
    this.map = map;
  }

  /**
   * @param {import('../entities/Enemy.js').Enemy[]} enemies
   * @param {import('../entities/Operator.js').Operator[]} operators
   */
  update(enemies, operators) {
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (enemy.stunTimer > 0) continue; // ogłuszony flashem = oślepiony
      for (const op of operators) {
        if (!op.alive) continue;
        if (this.canSee(enemy, op)) {
          this._raiseAlert(enemy, op.x, op.y, enemies);
        }
      }
    }
  }

  /**
   * Czy encja widzi cel: zasięg + stożek FOV wokół direction + LOS po masce.
   * @param {import('../entities/Entity.js').Entity} viewer
   * @param {import('../entities/Entity.js').Entity} target
   */
  canSee(viewer, target) {
    const dx = target.x - viewer.x;
    const dy = target.y - viewer.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CFG.LOS_RANGE) return false;
    const toTarget = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(viewer.direction, toTarget)) > degToRad(CFG.LOS_FOV_DEG) / 2) {
      return false;
    }
    return this.map.hasLineOfSight(viewer.x, viewer.y, target.x, target.y);
  }

  /**
   * Hałas (kopnięcie drzwi, strzał, wybuch): alarmuje wrogów w promieniu
   * radiusTiles od źródła. Dźwięk przechodzi przez ściany — sam promień,
   * bez testu LOS (brief: "Dźwięk wyzwala ALERT u wrogów w promieniu R kafelków").
   */
  raiseNoise(x, y, radiusTiles, enemies) {
    const radius = radiusTiles * this.map.tileSize;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (Math.hypot(enemy.x - x, enemy.y - y) <= radius) {
        this._alertOne(enemy, x, y);
      }
    }
  }

  /** Alarmuje wroga + wszystkich w promieniu ALERT_RADIUS_TILES od niego. */
  _raiseAlert(spotter, x, y, enemies) {
    this._alertOne(spotter, x, y);
    const radius = CFG.ALERT_RADIUS_TILES * this.map.tileSize;
    for (const other of enemies) {
      if (other === spotter || !other.alive) continue;
      if (Math.hypot(other.x - spotter.x, other.y - spotter.y) <= radius) {
        this._alertOne(other, x, y);
      }
    }
  }

  _alertOne(enemy, x, y) {
    enemy.state = 'ALERT';
    enemy.lastKnown = { x, y };
    enemy.alertTimer = CFG.ALERT_COOLDOWN_S;
  }
}
