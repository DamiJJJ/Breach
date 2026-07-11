import { CFG } from '../core/Config.js';
import { angleDiff, degToRad } from '../core/MathUtils.js';

/**
 * Akcje na drzwiach (Sprint 4; wykonawca węzłów DOOR CommandSystemu od
 * Sprintu 6). W kolejności pętli update stoi po Movement, przed Detection,
 * więc otwarcie drzwi jest widoczne dla percepcji jeszcze w tej samej klatce.
 *
 * Akcje briefu: OPEN_SLOW (ciche, DOOR_OPEN_SLOW_S), KICK (natychmiast,
 * hałas alarmuje wrogów w promieniu KICK_ALERT_TILES od drzwi), BREACH
 * (Sprint 7: wymaga gadżetu BREACH_CHARGE, podłożenie BREACH_PLANT_S,
 * drzwi trwale 'breached', huk BREACH_ALERT_TILES, ogłuszenie w stożku
 * BREACH_CONE_DEG od drzwi w głąb pomieszczenia — po przebudowie masek,
 * więc test LOS błysku działa już przez wyłom).
 *
 * Rozkaz trzymany jest na operatorze (op.doorAction — tylko dane); operator
 * najpierw dochodzi ścieżką do kafelka podejścia, a gdy stanie przy drzwiach,
 * system wykonuje akcję. JEDYNE miejsce zmiany door.state to setState() —
 * kontrakt briefu: (a) przebudowa collision matrix + gridu PF, (b) przebudowa
 * maski LOS/pocisków (jedno i drugie robi MapData.rebuildMasks), (c) dirty
 * warstwy #map (callback onDoorChanged podpina Game -> MapRenderer.markDirty).
 */
export class DoorSystem {
  /**
   * @param {object} deps
   * @param {import('../map/MapData.js').MapData} deps.map
   * @param {import('./DetectionSystem.js').DetectionSystem} deps.detection
   *   propagacja hałasu KICK (wstrzykuje Game — systemy nie importują się nawzajem)
   * @param {(door: import('../entities/Door.js').Door) => void} [deps.onDoorChanged]
   */
  constructor({ map, detection, onDoorChanged }) {
    this.map = map;
    this.detection = detection;
    this.onDoorChanged = onDoorChanged ?? null;
  }

  /**
   * Rozkaz akcji na drzwiach: dojdź (jeśli trzeba) i wykonaj.
   * @param {import('../entities/Operator.js').Operator} operator
   * @param {import('../entities/Door.js').Door} door
   * @param {'OPEN_SLOW'|'KICK'|'BREACH'} type
   * @returns {boolean} false gdy drzwi nie są zamknięte, podejście
   *   nieosiągalne albo (BREACH) brak ładunku wybuchowego
   */
  orderDoorAction(operator, door, type) {
    if (!operator?.alive || door.state !== 'closed') return false;
    if (type === 'BREACH'
      && (operator.gadget?.type !== 'BREACH_CHARGE' || operator.gadget.uses <= 0)) {
      return false;
    }

    if (this._inRange(operator, door)) {
      operator.setPath([]);
    } else {
      const path = this._pathToApproach(operator, door);
      if (!path) return false;
      operator.setPath(path);
    }
    const timer = type === 'BREACH' ? CFG.BREACH_PLANT_S : CFG.DOOR_OPEN_SLOW_S;
    operator.doorAction = { door, type, timer };
    return true;
  }

  /**
   * @param {import('../entities/Operator.js').Operator[]} operators
   * @param {import('../entities/Enemy.js').Enemy[]} enemies odbiorcy hałasu KICK
   * @param {number} dt sekundy
   */
  update(operators, enemies, dt) {
    for (const op of operators) {
      const action = op.doorAction;
      if (!action) continue;

      const { door } = action;
      if (!op.alive || door.state !== 'closed') {
        op.doorAction = null; // ktoś już otworzył / operator wyeliminowany
        continue;
      }
      if (op.stunTimer > 0) continue; // ogłuszony: dojście i odliczanie stoją
      if (op.path.length) continue; // w drodze do drzwi

      if (!this._inRange(op, door)) {
        op.doorAction = null; // dojście przerwane/nieudane — porzuć rozkaz
        continue;
      }

      const center = this.map.tileToWorld(door.x, door.y);
      op.direction = Math.atan2(center.y - op.y, center.x - op.x);

      if (action.type === 'KICK') {
        this.setState(door, 'open');
        this.detection.raiseNoise(center.x, center.y, CFG.KICK_ALERT_TILES, enemies);
        op.doorAction = null;
      } else if (action.type === 'BREACH') { // podłożenie ładunku, potem wybuch
        action.timer -= dt;
        if (action.timer <= 0) {
          op.gadget.uses--;
          this.setState(door, 'breached'); // maski już przebudowane dla stożka
          this.detection.raiseNoise(center.x, center.y, CFG.BREACH_ALERT_TILES, enemies);
          this._breachStun(op, center, operators, enemies);
          op.doorAction = null;
        }
      } else { // OPEN_SLOW — cicho, po czasie
        action.timer -= dt;
        if (action.timer <= 0) {
          this.setState(door, 'open');
          op.doorAction = null;
        }
      }
    }
  }

  /**
   * Ogłuszenie wybuchu breach: stożek BREACH_CONE_DEG od środka drzwi
   * w głąb (od operatora), zasięg BREACH_STUN_TILES, z testem LOS od drzwi
   * (wyłom już otwarty). Działa na obie strony — także na operatorów.
   */
  _breachStun(op, center, operators, enemies) {
    const coneDir = Math.atan2(center.y - op.y, center.x - op.x);
    this._stunCone(center, coneDir, operators);
    this._stunCone(center, coneDir, enemies);
  }

  _stunCone(center, coneDir, list) {
    const radius = CFG.BREACH_STUN_TILES * this.map.tileSize;
    const half = degToRad(CFG.BREACH_CONE_DEG) / 2;
    for (const entity of list) {
      if (!entity.alive) continue;
      const dist = Math.hypot(entity.x - center.x, entity.y - center.y);
      if (dist > radius) continue;
      const angle = Math.atan2(entity.y - center.y, entity.x - center.x);
      if (Math.abs(angleDiff(coneDir, angle)) > half) continue;
      if (!this.map.hasLineOfSight(center.x, center.y, entity.x, entity.y)) continue;
      entity.stunTimer = Math.max(entity.stunTimer, CFG.FLASH_STUN_S);
    }
  }

  /**
   * JEDYNA legalna zmiana stanu drzwi — wykonuje pełny kontrakt briefu:
   * obie maski + grid PF (rebuildMasks) i dirty warstwy #map (callback).
   * @param {import('../entities/Door.js').Door} door
   * @param {'closed'|'open'|'breached'} state
   */
  setState(door, state) {
    if (door.state === state) return;
    door.state = state;
    this.map.rebuildMasks();
    this.onDoorChanged?.(door);
  }

  _inRange(op, door) {
    const center = this.map.tileToWorld(door.x, door.y);
    return Math.hypot(op.x - center.x, op.y - center.y)
      <= CFG.DOOR_INTERACT_TILES * this.map.tileSize;
  }

  /**
   * Ścieżka do kafelka podejścia: przed/za drzwiami wg orientacji
   * (horizontal = drzwi w ścianie wschód-zachód, podejście z góry/dołu).
   * @returns {{x:number,y:number}[]|null}
   */
  _pathToApproach(operator, door) {
    const candidates = door.orientation === 'vertical'
      ? [[door.x - 1, door.y], [door.x + 1, door.y]]
      : [[door.x, door.y - 1], [door.x, door.y + 1]];

    // bliższy kafelek podejścia najpierw
    candidates.sort((a, b) => {
      const wa = this.map.tileToWorld(a[0], a[1]);
      const wb = this.map.tileToWorld(b[0], b[1]);
      return Math.hypot(wa.x - operator.x, wa.y - operator.y)
        - Math.hypot(wb.x - operator.x, wb.y - operator.y);
    });

    for (const [col, row] of candidates) {
      if (!this.map.isWalkable(col, row)) continue;
      const target = this.map.tileToWorld(col, row);
      const path = this.map.findPathWorld(operator.x, operator.y, target.x, target.y);
      if (path) return path;
    }
    return null;
  }
}
