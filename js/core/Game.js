import { Camera } from '../rendering/Camera.js';
import { MapRenderer } from '../rendering/MapRenderer.js';
import { EntityRenderer } from '../rendering/EntityRenderer.js';
import { Operator } from '../entities/Operator.js';
import { GameLoop } from './GameLoop.js';
import { InputHandler } from './InputHandler.js';
import { HUD } from '../ui/HUD.js';

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
    this.entityRenderer = new EntityRenderer(canvases.entities);
    this.hud = new HUD();

    this.operators = map.playerSpawns.map((s, i) => {
      const pos = map.tileToWorld(s.x, s.y);
      return new Operator(pos.x, pos.y, i);
    });
    this.operators[0].selected = true;

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
    // 3. Movement
    for (const op of this.operators) op.update(dt);
    // 8. Camera.update — follow środka zaznaczonych operatorów
    const targets = this.selectedOperators;
    this.camera.follow(targets.length ? targets : this.operators, dt);
  }

  /** Render — zawsze, także w PLANNING. */
  render() {
    this.mapRenderer.draw(this.camera, this.dpr);
    this.entityRenderer.draw(this.camera, this.dpr, this.operators);
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
