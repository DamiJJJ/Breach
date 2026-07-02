import { CFG } from '../core/Config.js';

/**
 * Decyzje wrogów (maszyna stanów na polach Enemy):
 *  - PATROL: pętla po punktach patrolu z postojem PATROL_PAUSE_S,
 *  - IDLE:   wartownik — wraca do home i obraca się do kierunku startowego,
 *  - ALERT:  idzie do lastKnown (przelicza ścieżkę, gdy cel się przesunął),
 *            na miejscu patrzy w stronę celu; po ALERT_COOLDOWN_S bez
 *            kontaktu (DetectionSystem odświeża timer) wraca do rutyny.
 *
 * Wołany PRZED ruchem (Movement) — ustawia cele ścieżek na tę klatkę.
 */
export class AISystem {
  /** @param {{map: import('../map/MapData.js').MapData}} deps */
  constructor({ map }) {
    this.map = map;
  }

  /**
   * @param {import('../entities/Enemy.js').Enemy[]} enemies
   * @param {number} dt sekundy
   */
  update(enemies, dt) {
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      switch (enemy.state) {
        case 'PATROL': this._patrol(enemy, dt); break;
        case 'IDLE': this._idle(enemy, dt); break;
        case 'ALERT': this._alert(enemy, dt); break;
      }
    }
  }

  _patrol(enemy, dt) {
    if (enemy.path.length) return;
    enemy.waitTimer -= dt;
    if (enemy.waitTimer > 0) return;

    const target = enemy.patrol[enemy.patrolIndex];
    if (Math.hypot(target.x - enemy.x, target.y - enemy.y) < this.map.tileSize * 0.25) {
      enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length;
      enemy.waitTimer = CFG.PATROL_PAUSE_S;
      return;
    }
    const path = this.map.findPathWorld(enemy.x, enemy.y, target.x, target.y);
    if (path) {
      enemy.setPath(path);
    } else {
      enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length; // punkt nieosiągalny — pomiń
    }
  }

  _idle(enemy, dt) {
    if (enemy.path.length) return;
    const { home } = enemy;
    if (Math.hypot(home.x - enemy.x, home.y - enemy.y) > 1) {
      const path = this.map.findPathWorld(enemy.x, enemy.y, home.x, home.y);
      if (path) enemy.setPath(path);
      return;
    }
    enemy.turnToward(home.direction, dt, CFG.ENEMY_TURN_RATE);
  }

  _alert(enemy, dt) {
    enemy.alertTimer -= dt;
    if (enemy.alertTimer <= 0) {
      // koniec alarmu — wróć do rutyny (IDLE sam zawróci do home)
      enemy.state = enemy.type === 'patrol' && enemy.patrol.length ? 'PATROL' : 'IDLE';
      enemy.lastKnown = null;
      enemy.pathTarget = null;
      enemy.setPath([]);
      enemy.waitTimer = 0;
      return;
    }

    const lk = enemy.lastKnown;
    const distToLk = Math.hypot(lk.x - enemy.x, lk.y - enemy.y);
    if (distToLk > this.map.tileSize * 0.75) {
      // idź sprawdzić; przelicz ścieżkę tylko gdy cel się realnie przesunął
      const stale = !enemy.pathTarget
        || Math.hypot(enemy.pathTarget.x - lk.x, enemy.pathTarget.y - lk.y) > this.map.tileSize / 2;
      if (stale) {
        const path = this.map.findPathWorld(enemy.x, enemy.y, lk.x, lk.y);
        if (path) {
          enemy.setPath(path);
          enemy.pathTarget = { x: lk.x, y: lk.y };
        }
      }
    } else if (enemy.path.length) {
      enemy.setPath([]); // jesteśmy na miejscu — stój i obserwuj
      enemy.pathTarget = null;
    }
    if (!enemy.path.length && distToLk > 1) {
      enemy.turnToward(Math.atan2(lk.y - enemy.y, lk.x - enemy.x), dt, CFG.ENEMY_TURN_RATE);
    }
  }
}
