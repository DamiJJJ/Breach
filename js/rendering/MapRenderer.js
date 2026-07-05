/**
 * Renderer mapy kafelkowej: rysuje mapę RAZ do offscreen canvasa i blituje
 * co klatkę. Re-render tylko po markDirty() (np. zmiana stanu drzwi).
 */
export class MapRenderer {
  /**
   * @param {import('../map/MapData.js').MapData} map
   * @param {HTMLCanvasElement} canvas warstwa #map
   */
  constructor(map, canvas) {
    this.map = map;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = map.widthPx;
    this.offscreen.height = map.heightPx;
    this.dirty = true;
  }

  markDirty() {
    this.dirty = true;
  }

  /** @param {import('./Camera.js').Camera} camera */
  draw(camera, dpr) {
    if (this.dirty) {
      this._renderOffscreen();
      this.dirty = false;
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    camera.applyTransform(ctx, dpr);
    ctx.drawImage(this.offscreen, 0, 0);
  }

  _renderOffscreen() {
    const ctx = this.offscreen.getContext('2d');
    const map = this.map;
    const ts = map.tileSize;

    ctx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const type = map.tileType(col, row);
        const x = col * ts;
        const y = row * ts;

        // podłoga wszędzie jako baza
        ctx.fillStyle = '#171b22';
        ctx.fillRect(x, y, ts, ts);
        ctx.strokeStyle = '#1f242e';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);

        if (type === 'wall') {
          ctx.fillStyle = '#3d4654';
          ctx.fillRect(x, y, ts, ts);
          ctx.fillStyle = '#4a5568';
          ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
        } else if (type === 'window') {
          // rama ściany + tafla — blokuje ruch, przepuszcza wzrok i pociski
          ctx.fillStyle = '#3d4654';
          ctx.fillRect(x, y, ts, ts);
          ctx.fillStyle = '#2e6d75';
          ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8);
          ctx.strokeStyle = '#5fd3de';
          ctx.strokeRect(x + 4.5, y + 4.5, ts - 9, ts - 9);
        }
      }
    }

    for (const door of map.doors) this._renderDoor(ctx, door, ts);
  }

  /**
   * closed: skrzydło w poprzek przejścia; open: skrzydło odchylone do
   * sąsiedniego kafelka (wizualnie — brief); breached: osmalone szczątki.
   * Framuga rysowana zawsze, żeby przejście po drzwiach było czytelne.
   */
  _renderDoor(ctx, door, ts) {
    const x = door.x * ts;
    const y = door.y * ts;
    const horizontal = door.orientation === 'horizontal';

    // framuga — dwa słupki na końcach przejścia
    ctx.fillStyle = '#2b3140';
    if (horizontal) {
      ctx.fillRect(x, y + ts / 2 - 6, 3, 12);
      ctx.fillRect(x + ts - 3, y + ts / 2 - 6, 3, 12);
    } else {
      ctx.fillRect(x + ts / 2 - 6, y, 12, 3);
      ctx.fillRect(x + ts / 2 - 6, y + ts - 3, 12, 3);
    }

    if (door.state === 'breached') {
      // trwale zniszczone — osmalenie + drzazgi zamiast skrzydła
      ctx.fillStyle = 'rgba(20, 14, 8, 0.6)';
      ctx.fillRect(x + 3, y + 3, ts - 6, ts - 6);
      ctx.fillStyle = '#4a3a24';
      ctx.fillRect(x + 5, y + ts / 2 - 2, 6, 4);
      ctx.fillRect(x + ts - 12, y + ts / 2 - 3, 7, 5);
      ctx.fillRect(x + ts / 2 - 2, y + ts / 2 + 4, 5, 4);
      return;
    }

    ctx.fillStyle = door.state === 'closed' ? '#7a5230' : '#5c3f26';
    if (door.state === 'closed') {
      if (horizontal) ctx.fillRect(x + 2, y + ts / 2 - 4, ts - 4, 8);
      else ctx.fillRect(x + ts / 2 - 4, y + 2, 8, ts - 4);
    } else if (horizontal) {
      // otwarte: skrzydło na zawiasie odchylone do kafelka powyżej
      ctx.fillRect(x + 1, y + ts / 2 - ts + 2, 8, ts - 4);
    } else {
      // otwarte: skrzydło odchylone do kafelka po lewej
      ctx.fillRect(x + ts / 2 - ts + 2, y + 1, ts - 4, 8);
    }
  }
}
