import type {
  AgentState,
  ControlMode,
  EgoState,
  HazardType,
  MetricsState,
  PipelineStage,
  PlannerState,
  Prediction,
  RiskLevel,
  RiskState,
  RoadDefinition,
  SafetyReflexState,
  ScenarioDefinition,
  ScenarioId,
  SimEvent,
  StaticObject,
  Vec2,
} from "./types";
import { SCENARIOS } from "./scenarios";
import { mulberry32 } from "./seededRandom";
import { initMetrics, updateMetrics } from "./metrics";
import { predictAgent, planEgoPath } from "./trajectoryPrediction";
import { assessRisk } from "./riskAssessment";
import { runPlanner, accelerationForTarget } from "./planner";
import { runSafetyReflex } from "./safetyReflex";
import { updateAgent } from "./agentModel";
import { updateEgo } from "./vehicleModel";
import { createHazardAgent, HAZARD_META } from "./hazards";
import { DETECTION_RANGE, EMERGENCY_DECEL, BASELINE_EMERGENCY_DECEL, PLANNER_DT, REFLEX_DT, MS_PER_KMH, SAFE_STOPPING_BUFFER } from "./constants";

export interface SimState {
  scenarioId: ScenarioId;
  scenario: ScenarioDefinition;
  mode: ControlMode;
  seed: number;
  rand: () => number;
  runId: string;
  simTime: number;
  nextPlannerTick: number;
  nextReflexTick: number;
  lastAmbientSecond: number;
  ego: EgoState;
  agents: AgentState[];
  staticObjects: StaticObject[];
  road: RoadDefinition;
  predictions: Prediction[];
  plannedPath: Vec2[];
  replanPath: Vec2[] | null;
  risk: RiskState;
  planner: PlannerState;
  reflex: SafetyReflexState;
  events: SimEvent[];
  eventSeq: number;
  metrics: MetricsState;
  pipelineStage: PipelineStage;
  controlAccel: number;
  controlLateral: number;
  lastRiskLevel: RiskLevel;
  lastPlannerMode: PlannerState["mode"];
  lastOverrideActive: boolean;
}

function makeRunId(seed: number): string {
  return `AX-${(seed % 9000 + 1000).toFixed(0)}`;
}

function pushEvent(state: SimState, category: SimEvent["category"], message: string) {
  state.eventSeq += 1;
  state.events.push({ id: state.eventSeq, time: state.simTime, category, message });
  if (state.events.length > 200) state.events.splice(0, state.events.length - 200);
}

export function createInitialState(scenarioId: ScenarioId, mode: ControlMode, seed: number): SimState {
  const scenario = SCENARIOS[scenarioId];
  const rand = mulberry32(seed);
  const nominalLateral = -Math.min(2.0, Math.max(1.3, (scenario.road.width / 2) * 0.45));
  const ego: EgoState = {
    position: { x: 0, y: nominalLateral },
    heading: 0,
    speed: (scenario.speedLimitKmh * 0.55) * MS_PER_KMH,
    acceleration: 0,
    targetLateral: nominalLateral,
    lateral: nominalLateral,
    braking: false,
    emergencyBraking: false,
    turnSignal: "none",
    traveled: 0,
  };

  const agents = scenario.initialAgents(rand);

  const risk: RiskState = assessRisk({
    ego,
    agents,
    predictions: [],
    road: scenario.road,
    staticObjects: scenario.staticObjects,
    mode,
  });

  const state: SimState = {
    scenarioId,
    scenario,
    mode,
    seed,
    rand,
    runId: makeRunId(seed),
    simTime: 0,
    nextPlannerTick: 0,
    nextReflexTick: 0,
    lastAmbientSecond: -1,
    ego,
    agents,
    staticObjects: scenario.staticObjects,
    road: scenario.road,
    predictions: [],
    plannedPath: planEgoPath(ego, scenario.road),
    replanPath: null,
    risk,
    planner: { mode: "CRUISE", targetSpeed: ego.speed, targetLateral: nominalLateral, reasons: ["System initializing · Left-lane cruising nominal"], lastUpdate: 0, decisionCount: 0, overtakePhase: "NONE", overtakeTargetId: null },
    reflex: { status: "MONITORING", triggers: [], lastUpdate: 0, overrideActive: false, activationCount: 0, stoppingMarginState: "NOMINAL" },
    events: [],
    eventSeq: 0,
    metrics: initMetrics(),
    pipelineStage: "SENSE",
    controlAccel: 0,
    controlLateral: nominalLateral,
    lastRiskLevel: "SAFE",
    lastPlannerMode: "CRUISE",
    lastOverrideActive: false,
  };

  pushEvent(state, "SYSTEM", "Vehicle initialized");
  pushEvent(state, "SYSTEM", "Perception online");
  pushEvent(state, "SYSTEM", "Planner online · 10 Hz");
  pushEvent(state, "SYSTEM", "Safety Reflex monitoring · 50 Hz");
  pushEvent(state, "SCENARIO", `Scenario loaded: ${scenario.name}`);

  return state;
}

export function injectHazard(state: SimState, hazard: HazardType): AgentState {
  const agent = createHazardAgent(hazard, state.ego, state.road, state.rand, state.simTime);
  state.agents.push(agent);
  if (state.metrics.hazardActiveSince === null) {
    state.metrics = { ...state.metrics, hazardActiveSince: state.simTime };
  }
  if (agent.hidden) {
    pushEvent(state, "RISK", `Occlusion detected · ${HAZARD_META[hazard].label}`);
  } else {
    pushEvent(state, "PERCEPTION", `${agent.type.toUpperCase()} ${agent.label} detected`);
  }
  pushEvent(state, "SCENARIO", `HAZARD INJECTED · ${agent.label}`);
  return agent;
}

function planModeMessage(mode: PlannerState["mode"]): string {
  switch (mode) {
    case "CRUISE":
      return "Cruise resumed";
    case "CAUTION_SLOW":
      return "Controlled deceleration requested";
    case "REPLAN":
      return "Lateral replan engaged";
    case "HOLD":
      return "Hold / strong deceleration requested";
  }
}

export function stepState(state: SimState, dt: number): void {
  const roadHalfWidth = state.road.width / 2;

  // --- Kinematics for all dynamic agents (perception/occlusion resolves
  // continuously as ego moves through the world) ---------------------------
  const previousHidden = new Map(state.agents.map((a) => [a.id, a.hidden]));
  const updatedAgents: AgentState[] = [];
  for (const a of state.agents) {
    const updated = updateAgent(a, dt, state.rand, state.ego.position.x, roadHalfWidth);
    if (updated.ttl !== undefined && state.simTime >= updated.ttl) continue;
    if (updated.position.x - state.ego.position.x <= -20) continue; // drop agents left far behind

    // Clean up cut-in hazard agents once they have moved far ahead beyond the visible frame
    if (updated.hazardTag === "twowheeler-cutin" && updated.position.x - state.ego.position.x > 95) {
      pushEvent(state, "SCENARIO", `Hazard cleared · ${updated.label} moved beyond frame`);
      continue;
    }

    updatedAgents.push(updated);
  }
  state.agents = updatedAgents;

  for (const a of state.agents) {
    const wasHidden = previousHidden.get(a.id);
    if (wasHidden && !a.hidden) {
      pushEvent(state, "PERCEPTION", `${a.type.toUpperCase()} ${a.label} revealed from occlusion`);
    }
  }

  // Ambient scenario spawns (e.g. intersection cross traffic).
  const currentSecond = Math.floor(state.simTime);
  if (state.scenario.ambientSpawn && currentSecond !== state.lastAmbientSecond) {
    state.lastAmbientSecond = currentSecond;
    const spawned = state.scenario.ambientSpawn(state.simTime, state.rand);
    if (spawned) state.agents.push(spawned);
  }

  // --- Planner tick (10 Hz): perception summary + prediction + planning ---
  if (state.simTime >= state.nextPlannerTick) {
    const relevant = state.agents.filter(
      (a) => !a.hidden && a.position.x - state.ego.position.x < DETECTION_RANGE && a.position.x - state.ego.position.x > -10,
    );
    state.predictions = relevant
      .filter((a) => a.type !== "obstacle")
      .map((a) => predictAgent(a));
    state.plannedPath = planEgoPath(state.ego, state.road);

    const prevPlannerMode = state.planner.mode;
    state.planner = runPlanner(state.planner, {
      ego: state.ego,
      risk: state.risk,
      speedLimitKmh: state.scenario.speedLimitKmh,
      mode: state.mode,
      simTime: state.simTime,
      agents: state.agents,
      roadHalfWidth,
    });
    state.replanPath = state.planner.mode === "REPLAN" ? planEgoPath({ ...state.ego, targetLateral: state.planner.targetLateral }, state.road) : null;
    state.metrics = { ...state.metrics, plannerDecisions: state.metrics.plannerDecisions + 1 };

    if (prevPlannerMode !== state.planner.mode) {
      pushEvent(state, "PLANNER", planModeMessage(state.planner.mode));
    }
    state.controlLateral = state.planner.targetLateral;
    state.nextPlannerTick += PLANNER_DT;
  }

  // --- Safety Reflex tick (50 Hz): fast risk re-evaluation + override -----
  if (state.simTime >= state.nextReflexTick) {
    state.risk = assessRisk({
      ego: state.ego,
      agents: state.agents,
      predictions: state.predictions,
      road: state.road,
      staticObjects: state.staticObjects,
      mode: state.mode,
    });

    state.reflex = runSafetyReflex(state.reflex, { risk: state.risk, mode: state.mode, simTime: state.simTime });

    if (state.reflex.overrideActive && !state.lastOverrideActive) {
      for (const t of state.reflex.triggers) pushEvent(state, "REFLEX", t);
      pushEvent(state, "CONTROL", "Emergency braking engaged");
      state.metrics = {
        ...state.metrics,
        interventions: state.metrics.interventions + 1,
        safetyOverrides: state.metrics.safetyOverrides + 1,
        reactionTimeMs:
          state.metrics.hazardActiveSince !== null
            ? (state.simTime - state.metrics.hazardActiveSince) * 1000
            : state.metrics.reactionTimeMs,
      };
    } else if (!state.reflex.overrideActive && state.lastOverrideActive) {
      pushEvent(state, "CONTROL", "Safety Reflex released — nominal control restored");
    }
    state.lastOverrideActive = state.reflex.overrideActive;

    if (state.risk.level !== state.lastRiskLevel) {
      pushEvent(state, "RISK", `Risk state → ${state.risk.level}`);
      if (state.risk.level === "SAFE") state.metrics = { ...state.metrics, hazardActiveSince: null };
    }
    state.lastRiskLevel = state.risk.level;

    // Near-miss / simulated collision flag: severe negative margin at speed.
    if (state.risk.stoppingMargin < -6 && state.ego.speed > 2.5 && state.mode === "BASELINE") {
      state.metrics = { ...state.metrics, collisions: state.metrics.collisions + 1 };
      pushEvent(state, "CONTROL", "Simulated collision risk threshold exceeded");
    }

    const emergencyDecel = state.mode === "ALIENX" ? EMERGENCY_DECEL : BASELINE_EMERGENCY_DECEL;
    const distToBuffer = Math.max(0, state.risk.nearestDistance - SAFE_STOPPING_BUFFER);
    state.controlAccel = state.reflex.overrideActive
      ? -emergencyDecel
      : accelerationForTarget(state.ego, state.planner.targetSpeed, distToBuffer);

    state.pipelineStage = state.reflex.overrideActive
      ? "ACT"
      : state.risk.level !== "SAFE"
        ? "PLAN"
        : "SENSE";

    state.nextReflexTick += REFLEX_DT;
  }

  // --- Physics integration (60 Hz) ----------------------------------------
  state.ego = updateEgo(state.ego, dt, state.controlAccel, state.controlLateral, state.reflex.overrideActive);
  state.metrics = updateMetrics(state.metrics, dt, state.ego.speed / MS_PER_KMH, state.risk.ttc, state.risk.score);
  state.simTime += dt;
}
