import { CFG } from '../core/Config.js';

/**
 * Węzeł kolejki rozkazów operatora (dane na op.orders — buduje i wykonuje
 * wyłącznie CommandSystem).
 * @typedef {object} OrderNode
 * @property {'MOVE'|'DOOR'|'WATCH'|'STOP'|'FLASH'} type
 * @property {number} [x] cel w world px (MOVE/WATCH/FLASH; dla DOOR środek drzwi)
 * @property {number} [y]
 * @property {import('../entities/Door.js').Door} [door] (DOOR)
 * @property {'OPEN_SLOW'|'KICK'|'BREACH'} [action] (DOOR)
 * @property {{x:number,y:number}[]|null} [preview] trasa do podglądu planu
 *   (MOVE; liczona przy kolejkowaniu — może być null, gdy cel chwilowo
 *   zablokowany np. zamkniętymi drzwiami)
 * @property {boolean} started czy węzeł został aktywowany
 */

/**
 * System rozkazów na ścieżce (Sprint 6) — slot 4 briefu: po Movement,
 * "wykonanie węzłów rozkazów osiągniętych w tej klatce". Kolejkę buduje się
 * w PLANNING i w EXECUTING (to tylko dane), wykonuje wyłącznie w EXECUTING.
 *
 * Węzły briefu: MOVE, STOP (czeka na sygnał GO — go-code do synchronizacji
 * wejść z kilku stron), WATCH_DIRECTION (obrót ku punktowi), DOOR (deleguje
 * do DoorSystem.orderDoorAction — wykonawcą akcji na drzwiach pozostaje
 * DoorSystem; od Sprintu 7 także akcja BREACH) oraz FLASH (Sprint 7: rzut
 * flashbangiem przez GadgetSystem; poza zasięgiem rzutu operator najpierw
 * podchodzi ścieżką, rzuca gdy tylko ma zasięg i LOS).
 *
 * Ścieżka węzła MOVE jest liczona przy AKTYWACJI węzła, nie przy kolejkowaniu
 * — dzięki temu MOVE za węzłem DOOR przechodzi przez drzwi, które w chwili
 * planowania były jeszcze zamknięte (grid PF jest wtedy już przebudowany —
 * kontrakt drzwi). `preview` liczony przy kolejkowaniu służy tylko do
 * rysowania planu i może być null.
 */
export class CommandSystem {
  /**
   * @param {object} deps
   * @param {import('../map/MapData.js').MapData} deps.map
   * @param {import('./DoorSystem.js').DoorSystem} deps.doorSystem wykonawca
   *   węzłów DOOR (wstrzykuje Game — systemy nie importują się nawzajem)
   * @param {import('./GadgetSystem.js').GadgetSystem} [deps.gadgetSystem]
   *   wykonawca węzłów FLASH (rzut flashbangiem)
   */
  constructor({ map, doorSystem, gadgetSystem = null }) {
    this.map = map;
    this.doorSystem = doorSystem;
    this.gadgetSystem = gadgetSystem;
    this._goSignal = false; // sygnał GO — zwalnia węzły STOP w tej klatce
  }

  /** Sygnał GO: wszyscy operatorzy stojący na węźle STOP ruszają dalej. */
  go() {
    this._goSignal = true;
  }

  /** Nowy rozkaz bez doklejania czyści kolejkę, ścieżkę i akcję na drzwiach. */
  clearOrders(op) {
    op.orders.length = 0;
    op.setPath([]);
    op.doorAction = null;
  }

  /**
   * Rozkaz ruchu. @param {boolean} append true = dołącz na koniec kolejki
   */
  queueMove(op, x, y, append) {
    if (!append) this.clearOrders(op);
    const from = this._queueEnd(op);
    op.orders.push({
      type: 'MOVE',
      x,
      y,
      preview: this.map.findPathWorld(from.x, from.y, x, y),
      started: false,
    });
  }

  /**
   * Akcja na drzwiach jako węzeł kolejki.
   * @param {'OPEN_SLOW'|'KICK'} action @param {boolean} append
   */
  queueDoor(op, door, action, append) {
    if (!append) this.clearOrders(op);
    const center = this.map.tileToWorld(door.x, door.y);
    op.orders.push({ type: 'DOOR', door, action, x: center.x, y: center.y, preview: null, started: false });
  }

  /** Obserwacja kierunku: obrót ku punktowi (zawsze doklejana do kolejki). */
  queueWatch(op, x, y) {
    op.orders.push({ type: 'WATCH', x, y, preview: null, started: false });
  }

  /** Przystanek: czekaj w miejscu na sygnał GO (zawsze doklejany). */
  queueStop(op) {
    op.orders.push({ type: 'STOP', preview: null, started: false });
  }

  /**
   * Rzut flashbangiem w punkt. @param {boolean} append
   */
  queueFlash(op, x, y, append) {
    if (!append) this.clearOrders(op);
    op.orders.push({ type: 'FLASH', x, y, preview: null, started: false });
  }

  /**
   * Wykonanie czoła kolejki każdego operatora. Wołane tylko w EXECUTING,
   * po Movement (dotarcie do węzła widziane w tej samej klatce).
   * @param {import('../entities/Operator.js').Operator[]} operators
   * @param {number} dt sekundy
   */
  update(operators, dt) {
    for (const op of operators) {
      if (!op.alive) {
        if (op.orders.length) op.orders.length = 0; // trup nie wykonuje planu
        continue;
      }
      if (op.stunTimer > 0) continue; // ogłuszony: plan zamrożony
      const node = op.orders[0];
      if (!node) continue;

      switch (node.type) {
        case 'MOVE':
          if (!node.started) {
            node.started = true;
            const path = this.map.findPathWorld(op.x, op.y, node.x, node.y);
            if (!path) {
              op.orders.shift(); // cel nieosiągalny — pomiń węzeł
              break;
            }
            op.setPath(path);
          } else if (!op.path.length) {
            op.orders.shift(); // dotarł
          }
          break;

        case 'DOOR':
          if (!node.started) {
            node.started = true;
            if (!this.doorSystem.orderDoorAction(op, node.door, node.action)) {
              op.orders.shift(); // drzwi już otwarte / podejście niemożliwe
            }
          } else if (!op.doorAction) {
            op.orders.shift(); // wykonane albo porzucone przez DoorSystem
          }
          break;

        case 'WATCH': {
          // W walce CombatSystem nadpisuje direction (prowadzenie lufy) —
          // węzeł dokończy obrót, gdy kontakt się skończy. To zamierzone.
          const target = Math.atan2(node.y - op.y, node.x - op.x);
          if (op.turnToward(target, dt, CFG.OPERATOR_TURN_RATE)) op.orders.shift();
          break;
        }

        case 'STOP':
          if (this._goSignal) op.orders.shift();
          break;

        case 'FLASH': {
          const gadget = op.gadget;
          if (!this.gadgetSystem || gadget?.type !== 'FLASHBANG' || gadget.uses <= 0) {
            op.orders.shift(); // brak granatu — węzeł przepada
            break;
          }
          const inRange =
            Math.hypot(node.x - op.x, node.y - op.y) <= CFG.FLASH_THROW_TILES * this.map.tileSize
            && this.map.hasLineOfSight(op.x, op.y, node.x, node.y);
          if (inRange) {
            op.setPath([]); // stój i rzucaj
            op.direction = Math.atan2(node.y - op.y, node.x - op.x);
            this.gadgetSystem.throwFlash(op, node.x, node.y);
            op.orders.shift();
          } else if (!node.started) {
            node.started = true;
            // za daleko / bez LOS — podejdź; rzut wypadnie w drodze
            const path = this.map.findPathWorld(op.x, op.y, node.x, node.y);
            if (!path) {
              op.orders.shift(); // nie da się podejść — węzeł przepada
              break;
            }
            op.setPath(path);
          } else if (!op.path.length) {
            op.orders.shift(); // doszedł, a rzut nadal niemożliwy — porzuć
          }
          break;
        }
      }
    }
    this._goSignal = false; // GO działa na wszystkich w jednej klatce
  }

  /** Punkt końcowy zaplanowanej kolejki — stąd liczymy preview kolejnego węzła. */
  _queueEnd(op) {
    for (let i = op.orders.length - 1; i >= 0; i--) {
      const node = op.orders[i];
      if (node.type === 'MOVE' || node.type === 'DOOR') return { x: node.x, y: node.y };
    }
    return { x: op.x, y: op.y };
  }
}
