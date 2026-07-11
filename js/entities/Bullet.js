import { CFG } from '../core/Config.js';

/**
 * Tracer — WYŁĄCZNIE wizualna smuga strzału (decyzja #1 briefu: walka to
 * hitscan, pocisk nie ma fizyki ani wykrywania trafień). Obiekty żyją w puli
 * CombatSystemu (CFG.TRACER_POOL) i są reużywane przez spawn() — zero `new`
 * w gorącej pętli strzałów.
 */
export class Bullet {
  constructor() {
    this.active = false;
    this.x0 = 0; // wylot lufy (world px)
    this.y0 = 0;
    this.x1 = 0; // punkt trafienia (world px)
    this.y1 = 0;
    this.ttl = 0; // s do zgaśnięcia (TRACER_TTL_S przy spawn)
  }

  /** Aktywuje smugę od strzelca do punktu trafienia (reużycie obiektu z puli). */
  spawn(x0, y0, x1, y1) {
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
    this.ttl = CFG.TRACER_TTL_S;
    this.active = true;
  }

  /** @param {number} dt sekundy */
  update(dt) {
    if (!this.active) return;
    this.ttl -= dt;
    if (this.ttl <= 0) this.active = false;
  }
}
