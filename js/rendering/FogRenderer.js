import { CFG } from '../core/Config.js';

/**
 * Warstwa #fog (najwyższy canvas) — mgła wojny o DWÓCH stanach:
 *  - poza polem widzenia: teren przyciemniony FOG_COLOR × FOG_DIM_ALPHA
 *    (operatorzy znają plan obiektu, więc cała mapa jest czytelna — ale
 *    wrogów i obiektów dynamicznych poza wzrokiem nie widać: to filtruje
 *    EntityRenderer po zbiorze visibleEnemies z VisionSystem),
 *  - w polu widzenia: czysto (wielokąty wycinane przez destination-out).
 *
 * Brak stanu "nieodkryte" i pamięci eksploracji — decyzja projektowa
 * (feedback z testów: pełne zakrycie utrudniało planowanie, a fabularnie
 * oddział ma mapę obiektu).
 *
 * Ścieżki rozkazów zaznaczonych operatorów rysowane są NAD mgłą — plan
 * wejścia w przyciemnione pomieszczenia musi pozostać w pełni czytelny
 * (dlatego ich rysowanie mieszka tu, nie w EntityRenderer pod mgłą).
 */
export class FogRenderer {
  /**
   * @param {import('../map/MapData.js').MapData} map
   * @param {HTMLCanvasElement} canvas warstwa #fog
   */
  constructor(map, canvas) {
    this.map = map;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * @param {import('./Camera.js').Camera} camera
   * @param {number} dpr
   * @param {{x:number,y:number}[][]} polygons wielokąty widoczności (VisionSystem)
   * @param {import('../entities/Operator.js').Operator[]} selectedOperators
   */
  draw(camera, dpr, polygons, selectedOperators = []) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    camera.applyTransform(ctx, dpr);

    // przyciemnienie całej mapy...
    ctx.globalAlpha = CFG.FOG_DIM_ALPHA;
    ctx.fillStyle = CFG.FOG_COLOR;
    ctx.fillRect(0, 0, this.map.widthPx, this.map.heightPx);
    ctx.globalAlpha = 1;

    // ...z wyciętym na czysto aktualnym polem widzenia
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#fff';
    for (const poly of polygons) this._fillPolygon(ctx, poly);
    ctx.globalCompositeOperation = 'source-over';

    for (const op of selectedOperators) this._drawPath(ctx, op);
  }

  _fillPolygon(ctx, points) {
    if (points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }

  _drawPath(ctx, op) {
    if (!op.path.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(124, 252, 155, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(op.x, op.y);
    for (const wp of op.path) ctx.lineTo(wp.x, wp.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const end = op.path[op.path.length - 1];
    ctx.strokeStyle = 'rgba(124, 252, 155, 0.9)';
    ctx.beginPath();
    ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
