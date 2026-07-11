import { angleDiff } from '../core/MathUtils.js';

/**
 * Baza encji: pozycja (world px, float), kierunek (radiany), HP,
 * podążanie po waypointach. Encje NIE importują systemów (decyzja #4 briefu)
 * — tylko dane + prosty update; ścieżki liczą i wstawiają systemy z zewnątrz.
 */
export class Entity {
  /**
   * @param {number} x world px
   * @param {number} y world px
   * @param {number} [hp]
   */
  constructor(x, y, hp = 100) {
    this.x = x;
    this.y = y;
    this.direction = 0; // radiany, 0 = w prawo, oś Y w dół
    this.hp = hp;
    this.maxHp = hp;
    this.alive = true;
    this.speed = 0; // px/s
    /** @type {{x:number,y:number}[]} waypointy w world px */
    this.path = [];

    // Pola walki (Sprint 5) — czyta i ustawia wyłącznie CombatSystem.
    this.fireCooldown = 0; // s do następnego strzału (kadencja)
    this.aimTimer = 0;     // s celowania pozostałe do pierwszego strzału
    /** @type {Entity|null} aktualnie ostrzeliwany cel */
    this.combatTarget = null;
  }

  /** @param {{x:number,y:number}[]|null} waypoints */
  setPath(waypoints) {
    this.path = waypoints ?? [];
  }

  /** @param {number} dt sekundy */
  update(dt) {
    this.followPath(dt);
  }

  /** Interpolacja po waypointach; ustawia direction zgodnie z ruchem. */
  followPath(dt) {
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

  /**
   * Obrót w miejscu ku zadanemu kątowi z ograniczoną prędkością.
   * @param {number} target radiany
   * @param {number} dt sekundy
   * @param {number} rate rad/s
   * @returns {boolean} true gdy kierunek osiągnięty
   */
  turnToward(target, dt, rate) {
    const diff = angleDiff(this.direction, target);
    const max = rate * dt;
    if (Math.abs(diff) <= max) {
      this.direction = target;
      return true;
    }
    const next = this.direction + Math.sign(diff) * max;
    this.direction = Math.atan2(Math.sin(next), Math.cos(next)); // normalizacja do [-PI, PI]
    return false;
  }
}
