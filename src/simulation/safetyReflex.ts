import type { ControlMode, RiskState, SafetyReflexState } from "./types";
import { TTC_CRITICAL_ALIENX, TTC_CRITICAL_BASELINE } from "./constants";

export interface ReflexInputs {
  risk: RiskState;
  mode: ControlMode;
  simTime: number;
}

// Runs at 50 Hz, independent from the 10 Hz planner. Purely reacts to
// physical safety-critical thresholds (TTC, stopping margin) — it does not
// negotiate comfort or lateral maneuvers, only whether to force an
// emergency braking override.
export function runSafetyReflex(state: SafetyReflexState, inputs: ReflexInputs): SafetyReflexState {
  const { risk, mode, simTime } = inputs;
  const critical = mode === "ALIENX" ? TTC_CRITICAL_ALIENX : TTC_CRITICAL_BASELINE;

  const triggers: string[] = [];
  const ttcCritical = risk.ttc <= critical;
  const marginViolated = risk.stoppingMargin < (mode === "ALIENX" ? 0 : -1.5);
  const conflictCritical = risk.pathConflict === "HIGH" && risk.ttc < critical * 1.4;

  if (ttcCritical) triggers.push("TTC CRITICAL");
  if (marginViolated) triggers.push("STOPPING MARGIN VIOLATED");
  if (conflictCritical) triggers.push("PATH CONFLICT");

  const shouldActivate = ttcCritical || marginViolated || (mode === "ALIENX" && conflictCritical);

  const marginState: SafetyReflexState["stoppingMarginState"] =
    risk.stoppingMargin < 0 ? "VIOLATED" : risk.stoppingMargin < 6 ? "TIGHT" : "NOMINAL";

  if (shouldActivate) {
    return {
      status: "ACTIVE",
      triggers,
      lastUpdate: simTime,
      overrideActive: true,
      activationCount: state.overrideActive ? state.activationCount : state.activationCount + 1,
      stoppingMarginState: marginState,
    };
  }

  // Release override once conditions are clearly safe again (hysteresis to
  // avoid rapid flicker in/out of intervention), or when scene is clear.
  const releaseSafe =
    (risk.ttc > critical * 1.6 && risk.stoppingMargin > 2) ||
    risk.level === "SAFE" ||
    risk.nearestAgentId === null;
  if (state.overrideActive && !releaseSafe) {
    return {
      ...state,
      status: "ACTIVE",
      triggers: triggers.length ? triggers : state.triggers,
      lastUpdate: simTime,
      stoppingMarginState: marginState,
    };
  }

  return {
    status: "MONITORING",
    triggers: [],
    lastUpdate: simTime,
    overrideActive: false,
    activationCount: state.activationCount,
    stoppingMarginState: marginState,
  };
}
