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
 * Plany rozkazów zaznaczonych operatorów (żywa ścieżka + węzły kolejki
 * CommandSystemu ze znacznikami: MOVE koło, DOOR kwadrat, WATCH strzałka,
 * STOP romb, FLASH gwiazdka) rysowane są NAD mgłą — plan wejścia w przyciemnione
 * pomieszczenia musi pozostać w pełni czytelny (dlatego ich rysowanie
 * mieszka tu, nie w EntityRenderer pod mgłą).
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

    for (const op of selectedOperators) this._drawPlan(ctx, op);
  }

  _fillPolygon(ctx, points) {
    if (points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }

  /** Żywa ścieżka + zakolejkowane węzły rozkazów (pisak wędruje po planie). */
  _drawPlan(ctx, op) {
    if (!op.path.length && !op.orders.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(124, 252, 155, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);

    let penX = op.x;
    let penY = op.y;
    if (op.path.length) {
      ctx.beginPath();
      ctx.moveTo(op.x, op.y);
      for (const wp of op.path) ctx.lineTo(wp.x, wp.y);
      ctx.stroke();
      const end = op.path[op.path.length - 1];
      penX = end.x;
      penY = end.y;
    }

    for (const node of op.orders) {
      if (node.type === 'MOVE' || node.type === 'DOOR') {
        ctx.beginPath();
        ctx.moveTo(penX, penY);
        // preview nieaktywnego MOVE; aktywny idzie już żywą ścieżką wyżej
        if (node.type === 'MOVE' && node.preview && !node.started) {
          for (const wp of node.preview) ctx.lineTo(wp.x, wp.y);
        }
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
        penX = node.x;
        penY = node.y;
      }
      this._drawOrderMarker(ctx, node, penX, penY);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** Znacznik węzła: MOVE koło, DOOR kwadrat, WATCH strzałka, STOP romb. */
  _drawOrderMarker(ctx, node, penX, penY) {
    ctx.save();
    ctx.setLineDash([]);
    switch (node.type) {
      case 'MOVE':
        ctx.strokeStyle = 'rgba(124, 252, 155, 0.9)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'DOOR':
        ctx.strokeStyle = 'rgba(252, 196, 124, 0.9)';
        ctx.strokeRect(node.x - 6, node.y - 6, 12, 12);
        break;
      case 'WATCH': {
        // strzałka z punktu planu w obserwowanym kierunku
        const angle = Math.atan2(node.y - penY, node.x - penX);
        const len = 18;
        const tipX = penX + Math.cos(angle) * len;
        const tipY = penY + Math.sin(angle) * len;
        ctx.strokeStyle = 'rgba(124, 200, 252, 0.9)';
        ctx.fillStyle = 'rgba(124, 200, 252, 0.9)';
        ctx.beginPath();
        ctx.moveTo(penX, penY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tipX + Math.cos(angle) * 6, tipY + Math.sin(angle) * 6);
        ctx.lineTo(tipX + Math.cos(angle + 2.5) * 6, tipY + Math.sin(angle + 2.5) * 6);
        ctx.lineTo(tipX + Math.cos(angle - 2.5) * 6, tipY + Math.sin(angle - 2.5) * 6);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'STOP':
        ctx.strokeStyle = 'rgba(252, 124, 124, 0.9)';
        ctx.beginPath();
        ctx.moveTo(penX, penY - 8);
        ctx.lineTo(penX + 8, penY);
        ctx.lineTo(penX, penY + 8);
        ctx.lineTo(penX - 8, penY);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'FLASH':
        // gwiazdka wybuchu w punkcie rzutu
        ctx.strokeStyle = 'rgba(255, 224, 102, 0.9)';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * i) / 3;
          ctx.moveTo(node.x - Math.cos(a) * 7, node.y - Math.sin(a) * 7);
          ctx.lineTo(node.x + Math.cos(a) * 7, node.y + Math.sin(a) * 7);
        }
        ctx.stroke();
        break;
    }
    ctx.restore();
  }
}
