// ALIEN X — core simulation type definitions.
// The browser engine implements the SimulationDataSource-style shape so that
// future adapters (MATLAB / Simulink / recorded runs) could supply the same
// structures without the UI layer changing.

export type Vec2 = { x: number; y: number };

export type ControlMode = "BASELINE" | "ALIENX";

export type ScenarioId =
  | "village-road"
  | "dense-market"
  | "intersection"
  | "highway-merge"
  | "cattle-crossing";

export type AgentType = "pedestrian" | "vehicle" | "bike" | "cattle" | "obstacle";

export type AgentBehavior =
  | "ambient" // background wandering / walking along shoulder
  | "cruise" // moving along the road in a lane
  | "crossing" // actively crossing the road
  | "cutIn" // merging into ego's lane
  | "erratic" // unpredictable (cattle)
  | "static"; // stationary obstacle

export interface AgentState {
  id: string;
  label: string;
  type: AgentType;
  position: Vec2;
  heading: number; // radians
  speed: number; // m/s
  radius: number; // meters, for drawing + collision envelope
  behavior: AgentBehavior;
  uncertainty: number; // 0..1 base predictive uncertainty
  hidden: boolean; // currently occluded from perception
  occluderId?: string; // static object hiding this agent
  revealDistance?: number; // ego distance at which agent becomes visible
  path?: Vec2[]; // waypoints (world space) the agent walks through
  pathIndex?: number;
  spawnTime: number;
  ttl?: number; // optional despawn time (sim seconds)
  hazardTag?: string; // set when spawned via hazard injection
}

export interface StaticObject {
  id: string;
  type: "building" | "stall" | "tree" | "pole" | "parkedVehicle" | "sign";
  position: Vec2;
  width: number;
  height: number;
  occludes?: boolean;
}

export interface RoadDefinition {
  length: number; // meters, total simulated road length (loops)
  width: number; // meters, drivable width
  laneCount: number;
  hasLaneMarkings: boolean;
  shoulder: number; // meters of shoulder on each side
  intersectionAt?: number; // world x for a cross-road, if any
  mergeAt?: number; // world x where a merge lane joins
  curvature: number; // amplitude of gentle sine curvature (meters)
}

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  descriptor: string;
  speedLimitKmh: number;
  road: RoadDefinition;
  staticObjects: StaticObject[];
  initialAgents: (rand: () => number) => AgentState[];
  ambientSpawn?: (simTime: number, rand: () => number) => AgentState | null;
}

export interface EgoState {
  position: Vec2;
  heading: number;
  speed: number; // m/s
  acceleration: number; // m/s^2 (signed)
  targetLateral: number; // desired lateral offset from lane centerline
  lateral: number; // current lateral offset
  braking: boolean;
  emergencyBraking: boolean;
  turnSignal: "left" | "right" | "none";
  traveled: number; // total meters traveled
}

export type RiskLevel = "SAFE" | "CAUTION" | "INTERVENE";
export type PathConflict = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export interface RiskState {
  score: number; // 0-100
  level: RiskLevel;
  ttc: number; // seconds, Infinity if none
  stoppingDistance: number; // meters
  stoppingMargin: number; // meters (can be negative)
  uncertainty: number; // 0-1
  pathConflict: PathConflict;
  occlusion: boolean;
  closingSpeed: number; // m/s
  nearestAgentId: string | null;
  nearestDistance: number;
  predictionConfidence: number; // 0-100
}

export type PlannerMode = "CRUISE" | "CAUTION_SLOW" | "REPLAN" | "HOLD";

export interface PlannerState {
  mode: PlannerMode;
  targetSpeed: number; // m/s
  targetLateral: number;
  reasons: string[];
  lastUpdate: number;
  decisionCount: number;
}

export type ReflexStatus = "MONITORING" | "ACTIVE";

export interface SafetyReflexState {
  status: ReflexStatus;
  triggers: string[];
  lastUpdate: number;
  overrideActive: boolean;
  activationCount: number;
  stoppingMarginState: "NOMINAL" | "TIGHT" | "VIOLATED";
}

export interface Prediction {
  agentId: string;
  points: Vec2[];
  uncertainty: number[]; // per-point radius meters
  conflict: boolean;
}

export type EventCategory =
  | "SYSTEM"
  | "SCENARIO"
  | "PERCEPTION"
  | "PREDICTION"
  | "RISK"
  | "PLANNER"
  | "REFLEX"
  | "CONTROL";

export interface SimEvent {
  id: number;
  time: number;
  category: EventCategory;
  message: string;
}

export interface MetricsState {
  elapsed: number;
  speedSampleSum: number;
  speedSampleCount: number;
  avgSpeedKmh: number;
  minTTC: number;
  maxRisk: number;
  reactionTimeMs: number | null;
  interventions: number;
  collisions: number;
  plannerDecisions: number;
  safetyOverrides: number;
  hazardActiveSince: number | null;
}

export type HazardType =
  | "pedestrian-crossing"
  | "twowheeler-cutin"
  | "sudden-obstacle"
  | "wrongside-vehicle"
  | "cattle-crossing"
  | "hidden-pedestrian";

export interface VisualizationLayers {
  detections: boolean;
  predictions: boolean;
  plannedPath: boolean;
  riskZones: boolean;
  objectLabels: boolean;
}

export interface EngineSnapshot {
  simTime: number;
  running: boolean;
  scenarioId: ScenarioId;
  mode: ControlMode;
  seed: number;
  runId: string;
  ego: EgoState;
  agents: AgentState[];
  staticObjects: StaticObject[];
  predictions: Prediction[];
  plannedPath: Vec2[];
  replanPath: Vec2[] | null;
  risk: RiskState;
  planner: PlannerState;
  reflex: SafetyReflexState;
  events: SimEvent[];
  metrics: MetricsState;
  road: RoadDefinition;
  demoActive: boolean;
  pipelineStage: PipelineStage;
}

export type PipelineStage =
  | "SENSE"
  | "UNDERSTAND"
  | "PREDICT"
  | "PLAN"
  | "VERIFY"
  | "REFLEX"
  | "ACT";

// Adapter boundary for future MATLAB / Simulink / recorded-run data sources.
export interface SimulationDataSource {
  getVehicleState(): EgoState;
  getAgents(): AgentState[];
  getPredictions(): Prediction[];
  getRiskAssessment(): RiskState;
  getPlannerState(): PlannerState;
}
