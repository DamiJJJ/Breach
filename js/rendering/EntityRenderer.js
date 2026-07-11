import { CFG } from '../core/Config.js';
import { degToRad } from '../core/MathUtils.js';

/**
 * Rysuje encje świata na warstwie #entities: stożki widzenia wrogów
 * (raycast po losMask — ucinane na ścianach, przechodzą przez okna),
 * wrogów i operatorów (kółko + trójkąt kierunku), trupy pod żywymi,
 * paski HP rannych i tracery strzałów (pula CombatSystemu). Czyszczona
 * i rysowana co klatkę. Wrogowie niewidoczni dla drużyny (VisionSystem)
 * są pomijani w całości — mgła na #fog przyciemnia tylko teren, ukrywanie
 * wrogów dzieje się tutaj. Tracery rysowane są zawsze (także strzał
 * z niewidocznego wroga — smuga zdradza ostrzał, to informacja dla gracza).
 * Ścieżki rozkazów rysuje FogRenderer (nad mgłą).
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
   * @param {Set<import('../entities/Enemy.js').Enemy>|null} visibleEnemies
   *   wrogowie widoczni dla drużyny (VisionSystem); null = rysuj wszystkich
   * @param {import('../entities/Bullet.js').Bullet[]} [tracers] pula CombatSystemu
   * @param {import('../systems/GadgetSystem.js').GadgetSystem} [gadgets]
   *   granaty w locie + rozbłyski (Sprint 7)
   */
  draw(camera, dpr, operators, enemies = [], visibleEnemies = null, tracers = [], gadgets = null) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    camera.applyTransform(ctx, dpr);

    const enemyVisible = (e) => !visibleEnemies || visibleEnemies.has(e);
    for (const enemy of enemies) {
      if (enemy.alive && enemyVisible(enemy)) this._drawVisionCone(ctx, enemy);
    }
    // trupy pod żywymi
    for (const enemy of enemies) {
      if (!enemy.alive && enemyVisible(enemy)) this._drawCorpse(ctx, enemy, CFG.ENEMY_RADIUS, '#5a2e2e', '#3c1f1f');
    }
    for (const op of operators) {
      if (!op.alive) this._drawCorpse(ctx, op, CFG.OPERATOR_RADIUS, '#31506e', '#22374d');
    }
    for (const enemy of enemies) {
      if (enemy.alive && enemyVisible(enemy)) this._drawEnemy(ctx, enemy);
    }
    for (const op of operators) {
      if (op.alive) this._drawOperator(ctx, op);
    }
    this._drawTracers(ctx, tracers);
    if (gadgets) {
      this._drawGrenades(ctx, gadgets.grenades);
      this._drawFlashes(ctx, gadgets.flashes);
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
    this._drawHpBar(ctx, enemy, r);
    this._drawStunRing(ctx, enemy, r);

    if (enemy.state === 'ALERT') {
      ctx.fillStyle = '#ff5050';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('!', enemy.x, enemy.y - r - 4);
    }
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
    this._drawHpBar(ctx, op, r);
    this._drawStunRing(ctx, op, r);
  }

  /** Granaty w locie: mały ciemnożółty punkt. */
  _drawGrenades(ctx, grenades) {
    ctx.fillStyle = '#c9b458';
    for (const g of grenades) {
      ctx.beginPath();
      ctx.arc(g.gx, g.gy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Rozbłysk flasha: rozszerzający się, gasnący biały okrąg. */
  _drawFlashes(ctx, flashes) {
    ctx.save();
    for (const f of flashes) {
      const k = 1 - f.ttl / CFG.FLASH_EFFECT_S; // 0 -> 1
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath();
      ctx.arc(f.x, f.y, k * CFG.FLASH_RADIUS_TILES * this.map.tileSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Przerywany żółty pierścień wokół ogłuszonej encji. */
  _drawStunRing(ctx, entity, r) {
    if (entity.stunTimer <= 0) return;
    ctx.save();
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Pasek HP pod encją — tylko gdy ranna (pełne zdrowie nie robi szumu). */
  _drawHpBar(ctx, entity, r) {
    if (entity.hp >= entity.maxHp) return;
    const w = 22;
    const h = 3;
    const x = entity.x - w / 2;
    const y = entity.y + r + 5;
    const pct = entity.hp / entity.maxHp;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = pct > 0.5 ? '#6fbf5f' : pct > 0.25 ? '#d8b13c' : '#d85b3c';
    ctx.fillRect(x, y, w * pct, h);
  }

  /** Trup: przygaszone kółko z krzyżykiem, bez trójkąta kierunku. */
  _drawCorpse(ctx, entity, r, fill, stroke) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const d = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(entity.x - d, entity.y - d);
    ctx.lineTo(entity.x + d, entity.y + d);
    ctx.moveTo(entity.x + d, entity.y - d);
    ctx.lineTo(entity.x - d, entity.y + d);
    ctx.stroke();
    ctx.restore();
  }

  /** Smugi strzałów — jasne linie gasnące z ttl (pula, może być pusta). */
  _drawTracers(ctx, tracers) {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffd27a';
    for (const t of tracers) {
      if (!t.active) continue;
      ctx.globalAlpha = Math.max(t.ttl / CFG.TRACER_TTL_S, 0) * 0.9;
      ctx.beginPath();
      ctx.moveTo(t.x0, t.y0);
      ctx.lineTo(t.x1, t.y1);
      ctx.stroke();
    }
    ctx.restore();
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
