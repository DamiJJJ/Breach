import { CFG } from '../core/Config.js';

/**
 * Kamera: x/y = lewy-górny róg widoku w world px + zoom.
 *
 * KONTRAKT (brief, sekcja "Kontrakt kamery"): transformacja renderu
 * i screenToWorld() są DOKŁADNYMI odwrotnościami:
 *   render:        setTransform(dpr) -> scale(zoom) -> translate(-x, -y)
 *   screenToWorld: (clientXY - rect) / zoom + camera.xy
 * rect liczony z canvasa (CSS px), więc działa też przy oknie niepełnoekranowym.
 */
export class Camera {
  /** @param {HTMLCanvasElement} canvas — canvas odniesienia dla getBoundingClientRect */
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.viewW = 0; // rozmiar widoku w CSS px
    this.viewH = 0;
  }

  setViewport(cssWidth, cssHeight) {
    this.viewW = cssWidth;
    this.viewH = cssHeight;
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    return {
      x: px / this.zoom + this.x,
      y: py / this.zoom + this.y,
    };
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom,
      y: (wy - this.y) * this.zoom,
    };
  }

  /** Ustawia transformację świata na kontekście (wołane co klatkę przez renderery). */
  applyTransform(ctx, dpr) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  centerOn(wx, wy) {
    this.x = wx - this.viewW / (2 * this.zoom);
    this.y = wy - this.viewH / (2 * this.zoom);
  }

  /**
   * Płynne śledzenie środka grupy encji (wygładzanie niezależne od FPS).
   * @param {{x:number,y:number}[]} entities
   */
  follow(entities, dt) {
    if (!entities.length) return;
    let cx = 0;
    let cy = 0;
    for (const e of entities) {
      cx += e.x;
      cy += e.y;
    }
    cx /= entities.length;
    cy /= entities.length;

    const tx = cx - this.viewW / (2 * this.zoom);
    const ty = cy - this.viewH / (2 * this.zoom);
    const t = 1 - Math.exp(-CFG.CAMERA_LERP * dt);
    this.x += (tx - this.x) * t;
    this.y += (ty - this.y) * t;
  }

  /** Zoom zakotwiczony w punkcie pod kursorem — punkt świata pod myszą zostaje w miejscu. */
  zoomAt(clientX, clientY, factor) {
    const before = this.screenToWorld(clientX, clientY);
    this.zoom = Math.min(CFG.ZOOM_MAX, Math.max(CFG.ZOOM_MIN, this.zoom * factor));
    const after = this.screenToWorld(clientX, clientY);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }
}
