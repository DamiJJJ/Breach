import { Entity } from './Entity.js';
import { CFG } from '../core/Config.js';

/**
 * Wróg — dane + ruch po ścieżce (z Entity). CAŁA logika decyzji żyje
 * w AISystem/DetectionSystem (encje nie importują systemów) — tutaj tylko
 * pola stanu, które systemy czytają i ustawiają.
 *
 * Stany: 'IDLE' (wartownik) | 'PATROL' | 'ALERT'.
 * Kąt facing z mapy: stopnie, 0 = w prawo, 90 = w dół (oś Y w dół).
 */
export class Enemy extends Entity {
  /**
   * @param {object} spec
   * @param {string} spec.id
   * @param {number} spec.x world px
   * @param {number} spec.y world px
   * @param {'patrol'|'stationary'} spec.type
   * @param {number} [spec.facingRad] radiany
   * @param {{x:number,y:number}[]} [spec.patrol] punkty patrolu w world px
   */
  constructor({ id, x, y, type, facingRad = 0, patrol = [] }) {
    super(x, y, 100);
    this.id = id;
    this.type = type;
    this.speed = CFG.ENEMY_SPEED;
    this.direction = facingRad;
    this.patrol = patrol;
    this.patrolIndex = 0;
    /** Pozycja/kierunek startowy — wartownik wraca tu po alarmie */
    this.home = { x, y, direction: facingRad };

    this.state = type === 'patrol' && patrol.length ? 'PATROL' : 'IDLE';
    /** @type {{x:number,y:number}|null} ostatnia znana pozycja celu */
    this.lastKnown = null;
    this.alertTimer = 0; // s bez kontaktu do zejścia z ALERT
    this.waitTimer = 0;  // s postoju na punkcie patrolu
    /** @type {{x:number,y:number}|null} cel aktualnie policzonej ścieżki (AISystem) */
    this.pathTarget = null;
  }
}
