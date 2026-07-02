/**
 * Baza encji: pozycja (world px, float), kierunek (radiany), HP.
 * Encje NIE importują systemów (decyzja #4 briefu) — tylko dane + prosty update.
 */
export class Entity {
  /**
   * @param {number} x world px
   * @param {number} y world px
   * @param {number} [hp]
   */
  constructor(x, y, hp = 100) {
    this.x = x;
    this.y = y;
    this.direction = 0; // radiany, 0 = w prawo, oś Y w dół
    this.hp = hp;
    this.alive = true;
  }

  /** @param {number} _dt sekundy */
  update(_dt) {}
}
