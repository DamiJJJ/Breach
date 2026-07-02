import { CFG } from './Config.js';

/**
 * Klawiatura + mysz. Pozycja myszy ZAWSZE przechodzi przez
 * Camera.screenToWorld() zanim zostanie zinterpretowana (kontrakt briefu).
 *
 * LPM = zaznaczenie (Shift = dodawanie), PPM = rozkaz ruchu,
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
      this._orderMove(world);
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

  _orderMove(world) {
    const map = this.game.map;
    for (const op of this.game.operators) {
      if (!op.selected) continue;
      const path = map.findPathWorld(op.x, op.y, world.x, world.y);
      if (path) op.setPath(path);
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
