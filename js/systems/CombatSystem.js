import { CFG } from '../core/Config.js';
import { Bullet } from '../entities/Bullet.js';

/**
 * Walka HITSCAN (Sprint 5). Strzał = natychmiastowy promień strzelec→cel:
 * czystą linię po masce pocisków (= losMask: ściana i zamknięte drzwi blokują,
 * okno przepuszcza) gwarantuje canSee z tej samej klatki, a pierwsza OBCA
 * encja na linii strzału przejmuje trafienie — friendly fire włączone
 * (operator w linii strzału obrywa zamiast celu). Bullet to wyłącznie tracer
 * z puli — bez fizyki, bez wykrywania trafień.
 *
 * Obie strony strzelają automatycznie do najbliższego widocznego wroga
 * (DetectionSystem.canSee: stożek FOV + zasięg + LOS) po czasie celowania
 * (OPERATOR_AIM_S / ENEMY_AIM_S — to drugie przybliża briefowe "ALERT: 1 s
 * przed COMBAT"), potem z kadencją (…_FIRE_COOLDOWN_S). Strzelec prowadzi
 * lufę: direction śledzi cel. Wystrzał operatora robi hałas
 * (SHOT_ALERT_TILES, przez ściany jak KICK); wystrzały wrogów nie — detekcja
 * i propagacja alarmu już ich obsługuje, a hałas wskazywałby pozycję
 * strzelca-wroga jako "cel" dla jego kolegów.
 *
 * MUSI być aktualizowany PO DetectionSystem (kolejność pętli odbiega od
 * briefu — patrz CLAUDE.md): strzela po LOS liczonym na pozycjach tej klatki.
 */
export class CombatSystem {
  /**
   * @param {object} deps
   * @param {import('./DetectionSystem.js').DetectionSystem} deps.detection
   *   test widzenia (canSee) + hałas wystrzału (wstrzykuje Game — systemy
   *   nie importują się nawzajem)
   */
  constructor({ detection }) {
    this.detection = detection;
    /** @type {Bullet[]} pula tracerów — stały rozmiar, reużycie najstarszej smugi */
    this.tracers = Array.from({ length: CFG.TRACER_POOL }, () => new Bullet());

    // Parametry broni obu stron — stałe obiekty, nie literały w pętli update.
    this._operatorWeapon = {
      damage: CFG.OPERATOR_DAMAGE,
      aimS: CFG.OPERATOR_AIM_S,
      cooldownS: CFG.OPERATOR_FIRE_COOLDOWN_S,
      noiseTiles: CFG.SHOT_ALERT_TILES,
    };
    this._enemyWeapon = {
      damage: CFG.ENEMY_DAMAGE,
      aimS: CFG.ENEMY_AIM_S,
      cooldownS: CFG.ENEMY_FIRE_COOLDOWN_S,
      noiseTiles: 0,
    };
    // Wynik skanu linii strzału — scratch reużywany między strzałami (bez alokacji).
    this._rayHit = { entity: null, t: 0 };
  }

  /**
   * @param {import('../entities/Operator.js').Operator[]} operators
   * @param {import('../entities/Enemy.js').Enemy[]} enemies
   * @param {number} dt sekundy
   */
  update(operators, enemies, dt) {
    for (const tracer of this.tracers) tracer.update(dt);
    for (const op of operators) {
      this._updateShooter(op, enemies, operators, enemies, dt, this._operatorWeapon);
    }
    for (const enemy of enemies) {
      this._updateShooter(enemy, operators, operators, enemies, dt, this._enemyWeapon);
    }
  }

  /**
   * Pełny cykl strzelca: wybór celu, prowadzenie lufy, celowanie, strzał.
   * @param {import('../entities/Entity.js').Entity} shooter
   * @param {import('../entities/Entity.js').Entity[]} hostiles cele strzelca
   * @param {import('../entities/Operator.js').Operator[]} operators do testu linii strzału
   * @param {import('../entities/Enemy.js').Enemy[]} enemies do testu linii strzału + hałasu
   * @param {number} dt sekundy
   * @param {{damage:number, aimS:number, cooldownS:number, noiseTiles:number}} weapon
   */
  _updateShooter(shooter, hostiles, operators, enemies, dt, weapon) {
    shooter.fireCooldown = Math.max(0, shooter.fireCooldown - dt);
    if (!shooter.alive || shooter.stunTimer > 0) {
      shooter.combatTarget = null; // STUNNED nie strzela (i AI nie "stoi w walce")
      return;
    }

    const target = this._acquireTarget(shooter, hostiles);
    if (!target) {
      shooter.combatTarget = null;
      return;
    }
    if (shooter.combatTarget !== target) {
      shooter.combatTarget = target;
      shooter.aimTimer = weapon.aimS; // nowy cel = celowanie od zera
    }
    // prowadzenie lufy — stożek FOV podąża za celem, więc cel nie wypada z kadru
    shooter.direction = Math.atan2(target.y - shooter.y, target.x - shooter.x);

    shooter.aimTimer -= dt;
    if (shooter.aimTimer > 0 || shooter.fireCooldown > 0) return;

    this._fire(shooter, target, operators, enemies, weapon);
    shooter.fireCooldown = weapon.cooldownS;
  }

  /**
   * Cel lepki: trzymaj bieżący póki żyje i jest widoczny (bez migotania
   * między równo odległymi wrogami), inaczej najbliższy widoczny wróg —
   * brief: "automatycznie do pierwszego wroga w LOS".
   */
  _acquireTarget(shooter, hostiles) {
    const current = shooter.combatTarget;
    if (current && current.alive && this.detection.canSee(shooter, current)) return current;

    let best = null;
    let bestDist = Infinity;
    for (const hostile of hostiles) {
      if (!hostile.alive) continue;
      const dist = Math.hypot(hostile.x - shooter.x, hostile.y - shooter.y);
      if (dist < bestDist && this.detection.canSee(shooter, hostile)) {
        best = hostile;
        bestDist = dist;
      }
    }
    return best;
  }

  /**
   * Hitscan: linia do celu jest czysta (canSee z tej klatki), ale pierwsza
   * inna encja na promieniu przejmuje trafienie (friendly fire). Tracer
   * kończy się w punkcie trafienia.
   */
  _fire(shooter, target, operators, enemies, weapon) {
    const dx = target.x - shooter.x;
    const dy = target.y - shooter.y;
    const distToTarget = Math.hypot(dx, dy);
    if (distToTarget < 1e-6) return;
    const nx = dx / distToTarget;
    const ny = dy / distToTarget;

    this._rayHit.entity = target;
    this._rayHit.t = distToTarget;
    this._scanRay(shooter, target, nx, ny, operators, CFG.OPERATOR_RADIUS);
    this._scanRay(shooter, target, nx, ny, enemies, CFG.ENEMY_RADIUS);

    const victim = this._rayHit.entity;
    this._spawnTracer(shooter.x, shooter.y, shooter.x + nx * this._rayHit.t, shooter.y + ny * this._rayHit.t);
    this._applyDamage(victim, weapon.damage);
    if (weapon.noiseTiles > 0) {
      this.detection.raiseNoise(shooter.x, shooter.y, weapon.noiseTiles, enemies);
    }
  }

  /**
   * Najbliższa encja z listy przecinająca promień strzału (okrąg o zadanym
   * promieniu vs odcinek strzelec→dotychczasowe trafienie). Wynik w _rayHit.
   */
  _scanRay(shooter, target, nx, ny, list, radius) {
    for (const entity of list) {
      if (entity === shooter || entity === target || !entity.alive) continue;
      const ex = entity.x - shooter.x;
      const ey = entity.y - shooter.y;
      const t = ex * nx + ey * ny; // rzut środka encji na oś promienia
      if (t <= 0 || t >= this._rayHit.t) continue;
      if (Math.abs(ex * ny - ey * nx) <= radius) {
        this._rayHit.entity = entity;
        this._rayHit.t = t;
      }
    }
  }

  /** Obrażenia + śmierć: trup traci ścieżkę, cel, zaznaczenie i rozkazy. */
  _applyDamage(entity, damage) {
    entity.hp -= damage;
    if (entity.hp > 0) return;
    entity.hp = 0;
    entity.alive = false;
    entity.setPath([]);
    entity.combatTarget = null;
    if ('selected' in entity) entity.selected = false;
    if ('doorAction' in entity) entity.doorAction = null;
    if ('orders' in entity) entity.orders.length = 0;
  }

  /** Smuga z puli: pierwsza wolna, a przy pełnej puli — najstarsza (reużycie). */
  _spawnTracer(x0, y0, x1, y1) {
    let slot = null;
    let oldest = null;
    let minTtl = Infinity;
    for (const tracer of this.tracers) {
      if (!tracer.active) {
        slot = tracer;
        break;
      }
      if (tracer.ttl < minTtl) {
        minTtl = tracer.ttl;
        oldest = tracer;
      }
    }
    (slot ?? oldest).spawn(x0, y0, x1, y1);
  }
}
