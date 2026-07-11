import { CFG } from '../core/Config.js';

/**
 * Gadżety rzucane (Sprint 7): lot flashbanga, detonacja, ogłuszenie.
 * Rzut to rzadkie zdarzenie (nie gorąca pętla), więc granaty i rozbłyski
 * mogą być alokowane per rzut — inaczej niż tracery strzałów.
 *
 * FLASHBANG (brief #9): rzut, ogłuszenie w promieniu FLASH_RADIUS_TILES na
 * FLASH_STUN_S. Ogłuszenie wymaga linii widzenia od punktu wybuchu (błysk
 * nie działa przez ścianę; przez okno tak — losMask), działa na OBIE strony
 * (nieostrożny rzut ogłusza własnych operatorów). Huk alarmuje wrogów w
 * promieniu FLASH_ALERT_TILES przez ściany, jak strzał/KICK.
 *
 * BREACH_CHARGE żyje w DoorSystem (to akcja na drzwiach) — tu tylko granaty.
 */
export class GadgetSystem {
  /**
   * @param {object} deps
   * @param {import('../map/MapData.js').MapData} deps.map
   * @param {import('./DetectionSystem.js').DetectionSystem} deps.detection
   *   hałas wybuchu (wstrzykuje Game — systemy nie importują się nawzajem)
   */
  constructor({ map, detection }) {
    this.map = map;
    this.detection = detection;
    /** @type {{x0:number,y0:number,x:number,y:number,gx:number,gy:number,t:number}[]} granaty w locie */
    this.grenades = [];
    /** @type {{x:number,y:number,ttl:number}[]} rozbłyski do renderu */
    this.flashes = [];
  }

  /**
   * Rzut flashbangiem: zdejmuje użycie i wypuszcza granat w lot
   * (detonacja po FLASH_FUSE_S w update). Zasięg/LOS sprawdza CommandSystem.
   * @param {import('../entities/Operator.js').Operator} op
   * @param {number} x cel w world px
   * @param {number} y
   */
  throwFlash(op, x, y) {
    op.gadget.uses--;
    this.grenades.push({ x0: op.x, y0: op.y, x, y, gx: op.x, gy: op.y, t: 0 });
  }

  /**
   * @param {import('../entities/Operator.js').Operator[]} operators
   * @param {import('../entities/Enemy.js').Enemy[]} enemies
   * @param {number} dt sekundy
   */
  update(operators, enemies, dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.t += dt;
      const k = Math.min(g.t / CFG.FLASH_FUSE_S, 1);
      g.gx = g.x0 + (g.x - g.x0) * k;
      g.gy = g.y0 + (g.y - g.y0) * k;
      if (g.t >= CFG.FLASH_FUSE_S) {
        this._detonate(g.x, g.y, operators, enemies);
        this.grenades.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].ttl -= dt;
      if (this.flashes[i].ttl <= 0) this.flashes.splice(i, 1);
    }
  }

  /** Błysk: stun w promieniu z testem LOS (obie strony) + huk dla wrogów. */
  _detonate(x, y, operators, enemies) {
    this.flashes.push({ x, y, ttl: CFG.FLASH_EFFECT_S });
    this._stunList(x, y, operators);
    this._stunList(x, y, enemies);
    this.detection.raiseNoise(x, y, CFG.FLASH_ALERT_TILES, enemies);
  }

  _stunList(x, y, list) {
    const radius = CFG.FLASH_RADIUS_TILES * this.map.tileSize;
    for (const entity of list) {
      if (!entity.alive) continue;
      if (Math.hypot(entity.x - x, entity.y - y) > radius) continue;
      if (!this.map.hasLineOfSight(x, y, entity.x, entity.y)) continue;
      entity.stunTimer = Math.max(entity.stunTimer, CFG.FLASH_STUN_S);
    }
  }
}
