import type {
  ControlMode,
  EngineSnapshot,
  HazardType,
  ScenarioId,
  VisualizationLayers,
} from "./types";
import { createInitialState, injectHazard, stepState, type SimState } from "./simState";
import { makeSeed } from "./seededRandom";
import { FIXED_DT, UI_PUBLISH_HZ } from "./constants";

export interface ComparisonResult {
  mode: ControlMode;
  minTTC: number;
  maxRisk: number;
  reactionTimeMs: number | null;
  interventions: number;
  collisions: number;
  avgSpeedKmh: number;
  scenarioCompleted: boolean;
}

export interface ComparisonRun {
  scenarioId: ScenarioId;
  hazard: HazardType;
  seed: number;
  baseline: ComparisonResult;
  alienx: ComparisonResult;
}

type Listener = (snapshot: EngineSnapshot) => void;

const DEFAULT_LAYERS: VisualizationLayers = {
  detections: true,
  predictions: true,
  plannedPath: true,
  riskZones: true,
  objectLabels: true,
};

// Scripted demo timeline. Every entry triggers a *real* engine action at the
// given simulation time (relative to demo start) — the resulting physics,
// perception, risk and reflex behaviour is entirely driven by the same
// deterministic simulation logic used in manual operation.
interface DemoStep {
  t: number;
  run: (engine: SimulationEngine) => void;
  done?: boolean;
}

export class SimulationEngine {
  private state: SimState;
  private running = true;
  private rafId: number | null = null;
  private lastFrameTime: number | null = null;
  private accumulator = 0;
  private listeners = new Set<Listener>();
  private lastPublish = 0;
  private layers: VisualizationLayers = { ...DEFAULT_LAYERS };
  private demoActive = false;
  private demoStartTime = 0;
  private demoSteps: DemoStep[] = [];
  private manualScroll = false;

  constructor(scenarioId: ScenarioId = "village-road", mode: ControlMode = "ALIENX", seed: number = makeSeed()) {
    this.state = createInitialState(scenarioId, mode, seed);
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  // --- Public control API ---------------------------------------------------
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  pause() {
    this.running = false;
    this.publish(true);
  }

  resume() {
    this.running = true;
    this.lastFrameTime = null;
  }

  isRunning() {
    return this.running;
  }

  reset(newSeed = false) {
    const seed = newSeed ? makeSeed() : this.state.seed;
    this.state = createInitialState(this.state.scenarioId, this.state.mode, seed);
    this.running = true;
    this.lastFrameTime = null;
    this.accumulator = 0;
    this.demoActive = false;
    this.demoSteps = [];
    this.publish(true);
  }

  setScenario(id: ScenarioId) {
    this.state = createInitialState(id, this.state.mode, makeSeed());
    this.running = true;
    this.demoActive = false;
    this.demoSteps = [];
    this.publish(true);
  }

  setMode(mode: ControlMode) {
    this.state = createInitialState(this.state.scenarioId, mode, this.state.seed);
    this.running = true;
    this.publish(true);
  }

  injectHazard(hazard: HazardType): string {
    const agent = injectHazard(this.state, hazard);
    this.publish(true);
    return agent.label;
  }

  setLayers(layers: Partial<VisualizationLayers>) {
    this.layers = { ...this.layers, ...layers };
  }

  getLayers(): VisualizationLayers {
    return this.layers;
  }

  setManualScroll(v: boolean) {
    this.manualScroll = v;
  }
  getManualScroll() {
    return this.manualScroll;
  }

  startDemo() {
    this.state = createInitialState("village-road", "ALIENX", makeSeed());
    this.running = true;
    this.demoActive = true;
    this.demoStartTime = this.state.simTime;
    this.demoSteps = [
      { t: 5, run: (e) => e.injectHazard("pedestrian-crossing") },
      { t: 11, run: (e) => e.injectHazard("twowheeler-cutin") },
    ];
    this.publish(true);
  }

  exitDemo() {
    this.demoActive = false;
    this.demoSteps = [];
    this.publish(true);
  }

  isDemoActive() {
    return this.demoActive;
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  // Runs an isolated, offline (non-rendered) deterministic simulation for a
  // fixed duration and hazard timing, used to build a fair Baseline vs
  // ALIEN X comparison from identical conditions.
  runComparison(scenarioId: ScenarioId, hazard: HazardType): ComparisonRun {
    const seed = makeSeed();
    const durationS = 20;
    const hazardAtS = 3;

    const simulateOnce = (mode: ControlMode): ComparisonResult => {
      const s = createInitialState(scenarioId, mode, seed);
      let hazardInjected = false;
      const steps = Math.round(durationS / FIXED_DT);
      for (let i = 0; i < steps; i++) {
        if (!hazardInjected && s.simTime >= hazardAtS) {
          injectHazard(s, hazard);
          hazardInjected = true;
        }
        stepState(s, FIXED_DT);
      }
      return {
        mode,
        minTTC: Number.isFinite(s.metrics.minTTC) ? s.metrics.minTTC : durationS,
        maxRisk: s.metrics.maxRisk,
        reactionTimeMs: s.metrics.reactionTimeMs,
        interventions: s.metrics.interventions,
        collisions: s.metrics.collisions,
        avgSpeedKmh: s.metrics.avgSpeedKmh,
        scenarioCompleted: s.metrics.collisions === 0,
      };
    };

    const baseline = simulateOnce("BASELINE");
    const alienx = simulateOnce("ALIENX");

    return { scenarioId, hazard, seed, baseline, alienx };
  }

  // --- Internal loop ---------------------------------------------------------
  private loop(now: number) {
    this.rafId = requestAnimationFrame(this.loop);

    if (!this.running) {
      this.lastFrameTime = now;
      return;
    }
    if (this.lastFrameTime === null) this.lastFrameTime = now;
    let frameTime = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    frameTime = Math.min(frameTime, 0.25);
    this.accumulator += frameTime;

    while (this.accumulator >= FIXED_DT) {
      if (this.demoActive) this.runDemoSteps();
      stepState(this.state, FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    if (now - this.lastPublish >= 1000 / UI_PUBLISH_HZ) {
      this.publish();
      this.lastPublish = now;
    }
  }

  private runDemoSteps() {
    const relTime = this.state.simTime - this.demoStartTime;
    for (const step of this.demoSteps) {
      if (!step.done && relTime >= step.t) {
        step.done = true;
        step.run(this);
      }
    }
  }

  private publish(force = false) {
    if (!force && this.listeners.size === 0) return;
    const snap = this.getSnapshot();
    for (const l of this.listeners) l(snap);
  }

  getSnapshot(): EngineSnapshot {
    const s = this.state;
    return {
      simTime: s.simTime,
      running: this.running,
      scenarioId: s.scenarioId,
      mode: s.mode,
      seed: s.seed,
      runId: s.runId,
      ego: s.ego,
      agents: s.agents,
      staticObjects: s.staticObjects,
      predictions: s.predictions,
      plannedPath: s.plannedPath,
      replanPath: s.replanPath,
      risk: s.risk,
      planner: s.planner,
      reflex: s.reflex,
      events: s.events,
      metrics: s.metrics,
      road: s.road,
      demoActive: this.demoActive,
      pipelineStage: s.pipelineStage,
    };
  }
}
