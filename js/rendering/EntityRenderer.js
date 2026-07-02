import { CFG } from '../core/Config.js';
import { degToRad } from '../core/MathUtils.js';

/**
 * Rysuje encje świata na warstwie #entities: stożki widzenia wrogów
 * (raycast po losMask — ucinane na ścianach, przechodzą przez okna),
 * wrogów, operatorów (kółko + trójkąt kierunku), zaznaczenie i ścieżki
 * rozkazów. Czyszczona i rysowana co klatkę.
 */
export class EntityRenderer {
  /**
   * @param {import('../map/MapData.js').MapData} map
   * @param {HTMLCanvasElement} canvas warstwa #entities
   */
  constructor(map, canvas) {
    this.map = map;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * @param {import('./Camera.js').Camera} camera
   * @param {number} dpr
   * @param {import('../entities/Operator.js').Operator[]} operators
   * @param {import('../entities/Enemy.js').Enemy[]} enemies
   */
  draw(camera, dpr, operators, enemies = []) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    camera.applyTransform(ctx, dpr);

    for (const enemy of enemies) {
      if (enemy.alive) this._drawVisionCone(ctx, enemy);
    }
    for (const op of operators) {
      if (op.selected) this._drawPath(ctx, op);
    }
    for (const enemy of enemies) {
      this._drawEnemy(ctx, enemy);
    }
    for (const op of operators) {
      this._drawOperator(ctx, op);
    }
  }

  _drawVisionCone(ctx, enemy) {
    const fov = degToRad(CFG.LOS_FOV_DEG);
    const rays = CFG.LOS_RAYS;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    for (let i = 0; i <= rays; i++) {
      const angle = enemy.direction - fov / 2 + (fov * i) / rays;
      const end = this.map.castRay(enemy.x, enemy.y, angle, CFG.LOS_RANGE);
      ctx.lineTo(end.x, end.y);
    }
    ctx.closePath();
    ctx.fillStyle = enemy.state === 'ALERT'
      ? 'rgba(255, 80, 80, 0.16)'
      : 'rgba(255, 214, 110, 0.10)';
    ctx.fill();
    ctx.restore();
  }

  _drawEnemy(ctx, enemy) {
    const r = CFG.ENEMY_RADIUS;

    // korpus
    ctx.fillStyle = '#e05252';
    ctx.strokeStyle = '#8f2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    this._drawDirectionTriangle(ctx, enemy, r, '#f7dcdc');

    if (enemy.state === 'ALERT') {
      ctx.fillStyle = '#ff5050';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('!', enemy.x, enemy.y - r - 4);
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

    this._drawDirectionTriangle(ctx, op, r, '#dce9f7');
  }

  _drawDirectionTriangle(ctx, entity, r, color) {
    const a = entity.direction;
    const tipX = entity.x + Math.cos(a) * (r + 7);
    const tipY = entity.y + Math.sin(a) * (r + 7);
    const baseA = a + Math.PI / 2;
    const bx = Math.cos(baseA) * 5;
    const by = Math.sin(baseA) * 5;
    const backX = entity.x + Math.cos(a) * (r - 2);
    const backY = entity.y + Math.sin(a) * (r - 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(backX + bx, backY + by);
    ctx.lineTo(backX - bx, backY - by);
    ctx.closePath();
    ctx.fill();
  }
}
