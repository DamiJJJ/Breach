import { CFG } from '../core/Config.js';

/**
 * Warstwa #fog (najwyższy canvas) — mgła wojny o trzech stanach:
 *  - nieodkryte:            pełny FOG_COLOR (mapa i wrogowie niewidoczni),
 *  - odkryte, poza wzrokiem: przyciemnienie FOG_EXPLORED_ALPHA (pamięć terenu),
 *  - w polu widzenia:       czyste.
 *
 * Pamięć odkrytego terenu akumuluje się w offscreenowym canvasie `explored`
 * (rozmiar mapy w px, trwały między klatkami). Mgła klatki składana jest w
 * `compose`: pełny FOG_COLOR → destination-out explored (rozjaśnienie do
 * FOG_EXPLORED_ALPHA) → destination-out aktualnych wielokątów (czysto).
 *
 * Ścieżki rozkazów zaznaczonych operatorów rysowane są NAD mgłą — planowanie
 * wejścia w nieodkryte pomieszczenia musi pozostać widoczne (dlatego ich
 * rysowanie mieszka tu, nie w EntityRenderer pod mgłą).
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

    this.explored = document.createElement('canvas');
    this.explored.width = map.widthPx;
    this.explored.height = map.heightPx;

    this.compose = document.createElement('canvas');
    this.compose.width = map.widthPx;
    this.compose.height = map.heightPx;
  }

  /**
   * @param {import('./Camera.js').Camera} camera
   * @param {number} dpr
   * @param {{x:number,y:number}[][]} polygons wielokąty widoczności (VisionSystem)
   * @param {import('../entities/Operator.js').Operator[]} selectedOperators
   */
  draw(camera, dpr, polygons, selectedOperators = []) {
    this._accumulateExplored(polygons);
    this._composeFog(polygons);

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    camera.applyTransform(ctx, dpr);
    ctx.drawImage(this.compose, 0, 0);

    for (const op of selectedOperators) this._drawPath(ctx, op);
  }

  _accumulateExplored(polygons) {
    const ctx = this.explored.getContext('2d');
    ctx.fillStyle = '#fff';
    for (const poly of polygons) this._fillPolygon(ctx, poly);
  }

  _composeFog(polygons) {
    const ctx = this.compose.getContext('2d');
    const { width, height } = this.compose;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = CFG.FOG_COLOR;
    ctx.fillRect(0, 0, width, height);

    // teren odkryty: destination-out zdejmuje (1 - FOG_EXPLORED_ALPHA) krycia,
    // zostaje przyciemnienie FOG_EXPLORED_ALPHA
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1 - CFG.FOG_EXPLORED_ALPHA;
    ctx.drawImage(this.explored, 0, 0);

    // aktualne pole widzenia: całkiem czyste
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    for (const poly of polygons) this._fillPolygon(ctx, poly);
    ctx.globalCompositeOperation = 'source-over';
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
