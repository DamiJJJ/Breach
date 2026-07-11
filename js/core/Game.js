import { Camera } from '../rendering/Camera.js';
import { MapRenderer } from '../rendering/MapRenderer.js';
import { EntityRenderer } from '../rendering/EntityRenderer.js';
import { Operator } from '../entities/Operator.js';
import { Enemy } from '../entities/Enemy.js';
import { AISystem } from '../systems/AISystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { DetectionSystem } from '../systems/DetectionSystem.js';
import { DoorSystem } from '../systems/DoorSystem.js';
import { VisionSystem } from '../systems/VisionSystem.js';
import { FogRenderer } from '../rendering/FogRenderer.js';
import { GameLoop } from './GameLoop.js';
import { InputHandler } from './InputHandler.js';
import { HUD } from '../ui/HUD.js';
import { degToRad } from './MathUtils.js';

/**
 * Główna klasa gry: maszyna stanów PLANNING/EXECUTING/RESULT, skleja systemy
 * i wstrzykuje referencje (encje NIE importują systemów).
 *
 * Kolejność update (docelowa lista systemów z briefu — Sprint 1 realizuje
 * tylko Movement i Camera; kolejne sprinty dokładają systemy w tej kolejności).
 */
export class Game {
  /**
   * @param {object} opts
   * @param {import('../map/MapData.js').MapData} opts.map
   * @param {{map:HTMLCanvasElement, entities:HTMLCanvasElement, fog:HTMLCanvasElement}} opts.canvases
   */
  constructor({ map, canvases }) {
    this.map = map;
    this.canvases = canvases;
    this.state = 'PLANNING';
    this.dpr = 1;

    // input i screenToWorld liczone względem najwyższej warstwy canvas
    this.camera = new Camera(canvases.fog);
    this.mapRenderer = new MapRenderer(map, canvases.map);
    this.entityRenderer = new EntityRenderer(map, canvases.entities);
    this.hud = new HUD();

    this.operators = map.playerSpawns.map((s, i) => {
      const pos = map.tileToWorld(s.x, s.y);
      return new Operator(pos.x, pos.y, i);
    });
    this.operators[0].selected = true;

    this.enemies = map.enemies.map((spec, i) => {
      const pos = map.tileToWorld(spec.x, spec.y);
      return new Enemy({
        id: spec.id ?? `enemy_${i}`,
        x: pos.x,
        y: pos.y,
        type: spec.type,
        facingRad: degToRad(spec.facing ?? 0),
        patrol: (spec.patrol ?? []).map(([col, row]) => map.tileToWorld(col, row)),
        armor: spec.armor,
      });
    });

    this.aiSystem = new AISystem({ map });
    this.detectionSystem = new DetectionSystem({ map });
    // zmiana stanu drzwi: rebuildMasks robi DoorSystem, dirty warstwy #map — tutaj
    this.doorSystem = new DoorSystem({
      map,
      detection: this.detectionSystem,
      onDoorChanged: () => this.mapRenderer.markDirty(),
    });
    this.combatSystem = new CombatSystem({ detection: this.detectionSystem });
    this.visionSystem = new VisionSystem({ map, detection: this.detectionSystem });
    this.fogRenderer = new FogRenderer(map, canvases.fog);

    this.input = new InputHandler({ canvas: canvases.fog, camera: this.camera, game: this });

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
      isRunning: () => this.state === 'EXECUTING',
    });

    this._handleResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._handleResize);
    this._handleResize();

    // start widoku na środku grupy spawnów
    const first = this.operators[0];
    this.camera.centerOn(first.x, first.y);
  }

  get selectedOperators() {
    return this.operators.filter((o) => o.selected);
  }

  start() {
    this.hud.setMission(this.map.name);
    this.hud.setState(this.state);
    this.loop.start();
  }

  toggleExecution() {
    if (this.state === 'RESULT') return;
    this.setState(this.state === 'PLANNING' ? 'EXECUTING' : 'PLANNING');
  }

  setState(state) {
    this.state = state;
    this.loop.resetTiming(); // bez teleportu po wznowieniu (kontrakt briefu)
    this.hud.setState(state);
  }

  /** Krok symulacji — tylko w EXECUTING (pilnuje GameLoop). */
  update(dt) {
    // 2. AI — decyzje wrogów (stany, cele ścieżek)
    this.aiSystem.update(this.enemies, dt);
    // 3. Movement
    for (const op of this.operators) op.update(dt);
    for (const enemy of this.enemies) enemy.update(dt);
    // 4. CommandSystem (na razie: akcje drzwi) — po ruchu, przed detekcją,
    //    żeby otwarcie drzwi było widoczne dla percepcji w tej samej klatce
    this.doorSystem.update(this.operators, this.enemies, dt);
    // 5. Detection — percepcja po ruchu, na pozycjach z tej klatki
    this.detectionSystem.update(this.enemies, this.operators);
    // 6. Combat — hitscan; MUSI stać PO Detection (świeży LOS — CLAUDE.md),
    //    to odpowiednik slotu 5 briefu w naszej kolejności
    this.combatSystem.update(this.operators, this.enemies, dt);
    // 8. Camera.update — follow środka zaznaczonych ŻYWYCH operatorów
    const alive = this.operators.filter((o) => o.alive);
    const targets = alive.filter((o) => o.selected);
    this.camera.follow(targets.length ? targets : (alive.length ? alive : this.operators), dt);
  }

  /** Render — zawsze, także w PLANNING. */
  render() {
    // widzenie liczone w fazie renderu, nie update — mgła musi żyć też w PLANNING
    const vision = this.visionSystem.compute(this.operators, this.enemies);
    this.mapRenderer.draw(this.camera, this.dpr);
    this.entityRenderer.draw(this.camera, this.dpr, this.operators, this.enemies, vision.visibleEnemies, this.combatSystem.tracers);
    this.fogRenderer.draw(this.camera, this.dpr, vision.polygons, this.selectedOperators);
  }

  /** DPR/Retina + resize wg kontraktu briefu. */
  _handleResize() {
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    for (const canvas of Object.values(this.canvases)) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }
    this.camera.setViewport(cssW, cssH);
  }
}
