import { CFG } from './Config.js';

/**
 * Pętla gry: requestAnimationFrame + fixed timestep (60 Hz) + klamp delty.
 *
 * Świat aktualizuje się tylko gdy isRunning() (stan EXECUTING); render zawsze.
 * resetTiming() wołane przy każdej zmianie stanu i powrocie do zakładki —
 * nazbierana delta nie powoduje "teleportu" (kontrakt briefu).
 */
export class GameLoop {
  /**
   * @param {object} opts
   * @param {(dt:number)=>void} opts.update    krok symulacji, dt w sekundach
   * @param {()=>void}          opts.render
   * @param {()=>boolean}       opts.isRunning czy świat ma być aktualizowany
   */
  constructor({ update, render, isRunning }) {
    this.update = update;
    this.render = render;
    this.isRunning = isRunning;
    this.last = 0;
    this.acc = 0;
    this.rafId = null;
    this._frame = this._frame.bind(this);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.resetTiming();
    });
  }

  start() {
    this.resetTiming();
    this.rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  resetTiming() {
    this.last = performance.now();
    this.acc = 0;
  }

  _frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = Math.min(dt, CFG.MAX_DT); // klamp — obowiązkowy wg briefu

    if (this.isRunning()) {
      this.acc += dt * 1000;
      while (this.acc >= CFG.STEP_MS) {
        this.update(CFG.STEP_MS / 1000);
        this.acc -= CFG.STEP_MS;
      }
    } else {
      this.acc = 0;
    }

    this.render();
    this.rafId = requestAnimationFrame(this._frame);
  }
}
