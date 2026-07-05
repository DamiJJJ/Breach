/**
 * Drzwi — jeden kafelek, stan: 'closed' | 'open' | 'breached' (dane bez logiki
 * systemowej; encje nie importują systemów — decyzja #4 briefu).
 *
 * Semantyka blokowania (tabela briefu): closed blokuje ruch/LOS/pociski,
 * open i breached nie blokują niczego; breached jest trwałe.
 *
 * NIE zmieniaj `state` ręcznie — każda zmiana stanu drzwi MUSI przebudować
 * obie maski + grid PF i oznaczyć warstwę #map jako dirty (kontrakt briefu),
 * a to robi wyłącznie DoorSystem.setState().
 */
export class Door {
  /**
   * @param {object} spec wpis z maps/*.json
   * @param {string} spec.id
   * @param {number} spec.x kolumna kafelka
   * @param {number} spec.y wiersz kafelka
   * @param {'horizontal'|'vertical'} [spec.orientation] horizontal = drzwi w ścianie
   *   wschód-zachód (podejście z góry/dołu)
   * @param {'standard'|'reinforced'} [spec.type]
   */
  constructor({ id, x, y, orientation = 'horizontal', type = 'standard' }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.orientation = orientation;
    this.type = type;
    /** @type {'closed'|'open'|'breached'} */
    this.state = 'closed';
  }
}
