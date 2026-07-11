import { CFG } from './Config.js';

/**
 * Klawiatura + mysz. Pozycja myszy ZAWSZE przechodzi przez
 * Camera.screenToWorld() zanim zostanie zinterpretowana (kontrakt briefu).
 *
 * LPM = zaznaczenie (Shift = dodawanie). Rozkazy idą do kolejki
 * CommandSystemu (Sprint 6): PPM = ruch (zastępuje kolejkę), Shift+PPM =
 * dołącz na koniec kolejki, PPM na zamkniętych drzwiach = ciche otwarcie
 * (Ctrl+PPM = kopniak, Alt+PPM = ładunek wybuchowy — Sprint 7), Alt+PPM
 * poza drzwiami = węzeł obserwacji kierunku, S = przystanek (STOP, czeka
 * na GO), G = sygnał GO (tylko w EXECUTING), F = rzut flashbangiem w punkt
 * pod kursorem (Shift+F dokleja do kolejki), kółko = zoom pod kursorem,
 * SPACJA = PLANNING <-> EXECUTING.
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

    // ostatnia znana pozycja kursora (px CSS) — cel dla rzutów z klawiatury
    this._mouse = { x: 0, y: 0 };

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => {
      this._mouse.x = e.clientX;
      this._mouse.y = e.clientY;
    });
    canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this._onKeyDown(e));
  }

  _onMouseDown(e) {
    const world = this.camera.screenToWorld(e.clientX, e.clientY);
    if (e.button === 0) {
      this._select(world, e.shiftKey);
    } else if (e.button === 2) {
      this._order(world, e);
    }
  }

  _select(world, additive) {
    const ops = this.game.operators;
    let hit = null;
    let bestDist = Infinity;
    for (const op of ops) {
      if (!op.alive) continue; // trup nie przyjmuje rozkazów
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

  /** PPM = rozkaz do kolejki: ruch / drzwi / obserwacja (Alt). Shift dokleja. */
  _order(world, e) {
    const map = this.game.map;
    const cmd = this.game.commandSystem;
    const selected = this.game.selectedOperators.filter((o) => o.alive);
    if (!selected.length) return;
    const append = e.shiftKey;

    const tile = map.worldToTile(world.x, world.y);
    const door = map.doorAt(tile.col, tile.row);
    // PPM na zamkniętych drzwiach = akcja na drzwiach (najbliższy zaznaczony
    // operator); Ctrl = KICK, Alt = BREACH (ładunek), bez modyfikatora = ciche
    if (door && door.state === 'closed') {
      const doorPos = map.tileToWorld(door.x, door.y);
      const action = e.altKey ? 'BREACH' : e.ctrlKey ? 'KICK' : 'OPEN_SLOW';
      // BREACH tylko dla operatora z ładunkiem — najbliższy uprawniony
      const eligible = action === 'BREACH'
        ? selected.filter((o) => o.gadget?.type === 'BREACH_CHARGE' && o.gadget.uses > 0)
        : selected;
      if (!eligible.length) return;
      const nearest = eligible.reduce((best, op) =>
        Math.hypot(op.x - doorPos.x, op.y - doorPos.y)
          < Math.hypot(best.x - doorPos.x, best.y - doorPos.y) ? op : best);
      cmd.queueDoor(nearest, door, action, append);
      return;
    }

    // Alt+PPM poza drzwiami = węzeł obserwacji kierunku (zawsze doklejany)
    if (e.altKey) {
      for (const op of selected) cmd.queueWatch(op, world.x, world.y);
      return;
    }

    for (const op of selected) cmd.queueMove(op, world.x, world.y, append);
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
    } else if (e.code === 'KeyS') {
      // przystanek: zaznaczeni czekają w tym punkcie planu na sygnał GO
      for (const op of this.game.selectedOperators) {
        if (op.alive) this.game.commandSystem.queueStop(op);
      }
    } else if (e.code === 'KeyG') {
      // GO tylko w akcji — wciśnięty w PLANNING nie może "wisieć" do wznowienia
      if (this.game.state === 'EXECUTING') this.game.commandSystem.go();
    } else if (e.code === 'KeyF') {
      // rzut flashbangiem w punkt pod kursorem — najbliższy zaznaczony
      // operator z granatem (Shift = dołącz do kolejki)
      const world = this.camera.screenToWorld(this._mouse.x, this._mouse.y);
      const throwers = this.game.selectedOperators.filter(
        (o) => o.alive && o.gadget?.type === 'FLASHBANG' && o.gadget.uses > 0);
      if (!throwers.length) return;
      const nearest = throwers.reduce((best, op) =>
        Math.hypot(op.x - world.x, op.y - world.y)
          < Math.hypot(best.x - world.x, best.y - world.y) ? op : best);
      this.game.commandSystem.queueFlash(nearest, world.x, world.y, e.shiftKey);
    }
  }
}
