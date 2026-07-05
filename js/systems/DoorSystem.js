import { CFG } from '../core/Config.js';

/**
 * Akcje na drzwiach (Sprint 4). Zalążek CommandSystem — w kolejności pętli
 * update stoi na pozycji 4 (po Movement, przed Detection), więc otwarcie
 * drzwi jest widoczne dla percepcji jeszcze w tej samej klatce.
 *
 * Akcje briefu: OPEN_SLOW (ciche, DOOR_OPEN_SLOW_S), KICK (natychmiast,
 * hałas alarmuje wrogów w promieniu KICK_ALERT_TILES od drzwi). BREACH
 * czeka na ładunek wybuchowy (Sprint 7) — stan 'breached' jest już
 * obsługiwany przez maski i render.
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
   * @param {'OPEN_SLOW'|'KICK'} type
   * @returns {boolean} false gdy drzwi nie są zamknięte albo podejście nieosiągalne
   */
  orderDoorAction(operator, door, type) {
    if (!operator?.alive || door.state !== 'closed') return false;

    if (this._inRange(operator, door)) {
      operator.setPath([]);
    } else {
      const path = this._pathToApproach(operator, door);
      if (!path) return false;
      operator.setPath(path);
    }
    operator.doorAction = { door, type, timer: CFG.DOOR_OPEN_SLOW_S };
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
