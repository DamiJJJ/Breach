import { CFG } from './Config.js';

/**
 * Klawiatura + mysz. Pozycja myszy ZAWSZE przechodzi przez
 * Camera.screenToWorld() zanim zostanie zinterpretowana (kontrakt briefu).
 *
 * LPM = zaznaczenie (Shift = dodawanie), PPM = rozkaz ruchu,
 * PPM na zamkniętych drzwiach = ciche otwarcie (Ctrl+PPM = kopniak),
 * kółko = zoom pod kursorem, SPACJA = PLANNING <-> EXECUTING.
 */
export class InputHandler {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas najwyższa warstwa canvas (odbiera zdarzenia)
   * @param {import('../rendering/Camera.js').Camera} opts.camera
   * @param {import('./Game.js').Game} opts.game
   */
  constructor({ canvas, camera, game }) {
    this.canvas = canvas;
    this.camera = camera;
    this.game = game;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this._onKeyDown(e));
  }

  _onMouseDown(e) {
    const world = this.camera.screenToWorld(e.clientX, e.clientY);
    if (e.button === 0) {
      this._select(world, e.shiftKey);
    } else if (e.button === 2) {
      this._orderMove(world, e.ctrlKey);
    }
  }

  _select(world, additive) {
    const ops = this.game.operators;
    let hit = null;
    let bestDist = Infinity;
    for (const op of ops) {
      const d = Math.hypot(op.x - world.x, op.y - world.y);
      if (d <= CFG.SELECT_RADIUS && d < bestDist) {
        hit = op;
        bestDist = d;
      }
    }
    if (hit) {
      if (additive) {
        hit.selected = !hit.selected;
      } else {
        for (const op of ops) op.selected = false;
        hit.selected = true;
      }
    } else if (!additive) {
      for (const op of ops) op.selected = false;
    }
  }

  _orderMove(world, kick = false) {
    const map = this.game.map;
    const tile = map.worldToTile(world.x, world.y);
    const door = map.doorAt(tile.col, tile.row);

    // PPM na zamkniętych drzwiach = akcja na drzwiach (najbliższy zaznaczony
    // operator); Ctrl = KICK, bez Ctrl = ciche otwarcie
    if (door && door.state === 'closed') {
      const selected = this.game.selectedOperators;
      if (!selected.length) return;
      const doorPos = map.tileToWorld(door.x, door.y);
      const nearest = selected.reduce((best, op) =>
        Math.hypot(op.x - doorPos.x, op.y - doorPos.y)
          < Math.hypot(best.x - doorPos.x, best.y - doorPos.y) ? op : best);
      this.game.doorSystem.orderDoorAction(nearest, door, kick ? 'KICK' : 'OPEN_SLOW');
      return;
    }

    for (const op of this.game.operators) {
      if (!op.selected) continue;
      const path = map.findPathWorld(op.x, op.y, world.x, world.y);
      if (path) {
        op.setPath(path);
        op.doorAction = null; // nowy rozkaz ruchu anuluje akcję na drzwiach
      }
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? CFG.ZOOM_FACTOR : 1 / CFG.ZOOM_FACTOR;
    this.camera.zoomAt(e.clientX, e.clientY, factor);
  }

  _onKeyDown(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      this.game.toggleExecution();
    }
  }
}
