import type { ControlMode, EgoState, PlannerState, RiskState, AgentState } from "./types";
import { CRUISE_ACCEL, COMFORT_DECEL, MS_PER_KMH, TTC_CAUTION, TTC_COMFORT } from "./constants";

export interface PlannerInputs {
  ego: EgoState;
  risk: RiskState;
  speedLimitKmh: number;
  mode: ControlMode;
  simTime: number;
  agents: AgentState[];
  roadHalfWidth: number;
}

// Runs at 10 Hz. Produces a target speed + lateral offset and a short
// human-readable reasoning trail consumed by the Explainability panel.
export function runPlanner(state: PlannerState, inputs: PlannerInputs): PlannerState {
  const { ego, risk, speedLimitKmh, mode, agents, roadHalfWidth } = inputs;
  const speedLimit = speedLimitKmh * MS_PER_KMH;
  const reasons: string[] = [];
  let mode2: PlannerState["mode"] = "CRUISE";
  let targetSpeed = speedLimit;
  let targetLateral = state.targetLateral;

  const cautionTtcThreshold = mode === "ALIENX" ? TTC_COMFORT : TTC_COMFORT * 0.7;
  const hardTtcThreshold = mode === "ALIENX" ? TTC_CAUTION : TTC_CAUTION * 0.75;

  if (risk.level === "SAFE" && risk.ttc > cautionTtcThreshold && risk.stoppingMargin > 8) {
    reasons.push("No immediate path conflict");
    reasons.push("TTC above intervention threshold");
    reasons.push("Prediction confidence stable");
    reasons.push("Stopping margin adequate");
    mode2 = "CRUISE";
    targetSpeed = speedLimit;
  } else if (risk.level !== "SAFE" || risk.ttc <= cautionTtcThreshold) {
    reasons.push(
      risk.nearestAgentId ? `Relevant agent tracked · ${risk.nearestAgentId}` : "Elevated uncertainty in scene",
    );
    if (risk.pathConflict !== "NONE") reasons.push(`Predicted trajectory conflict → ${risk.pathConflict}`);
    if (risk.ttc < 99) reasons.push(`TTC decreasing (${risk.ttc.toFixed(1)}s)`);
    if (risk.uncertainty > 0.35) reasons.push("Uncertainty rising");
    if (risk.stoppingMargin < 8) reasons.push(`Stopping margin tight (${risk.stoppingMargin.toFixed(1)}m)`);

    if (risk.ttc <= hardTtcThreshold || risk.stoppingMargin < 0) {
      mode2 = "HOLD";
      targetSpeed = 0;
      reasons.push("Requesting strong deceleration");
    } else {
      mode2 = "CAUTION_SLOW";
      // Scale target speed down proportionally to risk severity.
      const factor = risk.level === "INTERVENE" ? 0.15 : risk.level === "CAUTION" ? 0.45 : 0.75;
      targetSpeed = Math.max(0, speedLimit * factor);
    }

    // Lateral nudge away from a cut-in / crossing agent when there is room.
    const threat = agents.find((a) => a.id === risk.nearestAgentId);
    if (threat && (threat.behavior === "cutIn" || threat.behavior === "crossing") && risk.pathConflict !== "NONE") {
      mode2 = mode2 === "HOLD" ? "HOLD" : "REPLAN";
      const preferredSide = threat.position.y > ego.lateral ? -1 : 1;
      targetLateral = Math.max(-roadHalfWidth + 1.2, Math.min(roadHalfWidth - 1.2, preferredSide * 1.1));
      reasons.push("Lateral replan evaluated");
    } else {
      targetLateral = 0;
    }
  }

  return {
    mode: mode2,
    targetSpeed,
    targetLateral,
    reasons,
    lastUpdate: inputs.simTime,
    decisionCount: state.decisionCount + 1,
  };
}

export function accelerationForTarget(ego: EgoState, targetSpeed: number): number {
  const diff = targetSpeed - ego.speed;
  if (diff > 0.2) return Math.min(CRUISE_ACCEL, diff * 0.8);
  if (diff < -0.2) return -Math.min(COMFORT_DECEL, Math.abs(diff) * 0.9 + 0.6);
  return 0;
}
