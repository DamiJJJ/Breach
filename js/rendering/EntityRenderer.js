import { CFG } from '../core/Config.js';

/**
 * Rysuje encje świata na warstwie #entities: operatorów (kółko + trójkąt
 * kierunku), zaznaczenie i ścieżki rozkazów. Czyszczona i rysowana co klatkę.
 */
export class EntityRenderer {
  /** @param {HTMLCanvasElement} canvas warstwa #entities */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * @param {import('./Camera.js').Camera} camera
   * @param {number} dpr
   * @param {import('../entities/Operator.js').Operator[]} operators
   */
  draw(camera, dpr, operators) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    camera.applyTransform(ctx, dpr);

    for (const op of operators) {
      if (op.selected) this._drawPath(ctx, op);
    }
    for (const op of operators) {
      this._drawOperator(ctx, op);
    }
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

  _drawOperator(ctx, op) {
    const r = CFG.OPERATOR_RADIUS;

    if (op.selected) {
      ctx.strokeStyle = '#7CFC9B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(op.x, op.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // korpus
    ctx.fillStyle = '#4da3ff';
    ctx.strokeStyle = '#1d5c9e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(op.x, op.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // trójkąt kierunku
    const a = op.direction;
    const tipX = op.x + Math.cos(a) * (r + 7);
    const tipY = op.y + Math.sin(a) * (r + 7);
    const baseA = a + Math.PI / 2;
    const bx = Math.cos(baseA) * 5;
    const by = Math.sin(baseA) * 5;
    const backX = op.x + Math.cos(a) * (r - 2);
    const backY = op.y + Math.sin(a) * (r - 2);
    ctx.fillStyle = '#dce9f7';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(backX + bx, backY + by);
    ctx.lineTo(backX - bx, backY - by);
    ctx.closePath();
    ctx.fill();
  }
}
