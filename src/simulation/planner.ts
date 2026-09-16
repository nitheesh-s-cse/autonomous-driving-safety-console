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
  const nominalLane = -Math.min(2.0, Math.max(1.3, roadHalfWidth * 0.45)); // Indian rules: nominal driving in left lane
  const overtakeLane = Math.min(2.0, Math.max(1.3, roadHalfWidth * 0.45));  // Indian rules: overtake via right lane

  let overtakePhase: "NONE" | "PASSING" | "RETURNING" = state.overtakePhase || "NONE";
  let overtakeTargetId: string | null = state.overtakeTargetId || null;

  // --- Autonomous Overtake Subsystem (ALIEN X) -------------------------------
  // Indian traffic rules compliant: Drives normally in the LEFT lane.
  // When encountering a slower vehicle ahead, overtakes via the RIGHT lane,
  // then safely returns to the LEFT lane.
  if (mode === "ALIENX") {
    // 1. If currently in PASSING phase:
    if (overtakePhase === "PASSING" && overtakeTargetId) {
      const target = agents.find((a) => a.id === overtakeTargetId);
      if (target) {
        const dx = target.position.x - ego.position.x;
        // Keep passing until ego has advanced safely past the target vehicle (+9.0m)
        if (dx > -9.0) {
          return {
            mode: "REPLAN",
            targetSpeed: Math.min(speedLimit, Math.max(ego.speed, target.speed + 3.2)),
            targetLateral: overtakeLane, // Overtake via right lane
            reasons: [
              `Autonomous overtake in progress · Passing ${target.label} via right lane (Indian rules)`,
              "Replan trajectory active · Right corridor engaged",
              "Maintaining safe lateral separation envelope",
            ],
            lastUpdate: inputs.simTime,
            decisionCount: state.decisionCount + 1,
            overtakePhase: "PASSING",
            overtakeTargetId,
          };
        } else {
          // Completed pass! Switch to RETURNING phase back to left lane
          overtakePhase = "RETURNING";
          return {
            mode: "REPLAN",
            targetSpeed: speedLimit,
            targetLateral: nominalLane, // Return to left lane
            reasons: [
              `Overtake of ${target.label} complete · Returning to left lane (Indian rules)`,
              "Re-centering trajectory engaged · Nominal left corridor restoring",
            ],
            lastUpdate: inputs.simTime,
            decisionCount: state.decisionCount + 1,
            overtakePhase: "RETURNING",
            overtakeTargetId,
          };
        }
      } else {
        overtakePhase = "NONE";
        overtakeTargetId = null;
      }
    }

    // 2. If in RETURNING phase:
    if (overtakePhase === "RETURNING") {
      if (Math.abs(ego.lateral - nominalLane) < 0.22) {
        // Successfully re-centered in left lane!
        overtakePhase = "NONE";
        overtakeTargetId = null;
      } else {
        return {
          mode: "REPLAN",
          targetSpeed: speedLimit,
          targetLateral: nominalLane,
          reasons: [
            "Returning to left travel lane after overtake (Indian rules)",
            "Smoothly re-centering vehicle heading and lateral offset in left lane",
          ],
          lastUpdate: inputs.simTime,
          decisionCount: state.decisionCount + 1,
          overtakePhase: "RETURNING",
          overtakeTargetId,
        };
      }
    }

    // 3. If in NONE phase, check if we should initiate an overtake:
    if (overtakePhase === "NONE") {
      const slowVehicle = agents.find((a) => {
        if (a.type !== "bike" && a.type !== "vehicle") return false;
        if (a.behavior !== "cruise" && a.behavior !== "ambient") return false;
        const dx = a.position.x - ego.position.x;
        // Approaching slow vehicle ahead between 4m and 38m
        if (dx <= 4 || dx > 38) return false;
        // Moving slower than our target speed limit by at least 2.0 m/s
        if (a.speed >= speedLimit * 0.85) return false;
        // Within our left lane corridor
        if (Math.abs(a.position.y - ego.lateral) > 2.0) return false;
        return true;
      });

      if (slowVehicle) {
        const isRoadSpaceAvailable = Math.abs(overtakeLane) <= roadHalfWidth - 0.8;
        const isAdjacentClear = !agents.some(
          (a) =>
            a.id !== slowVehicle.id &&
            Math.abs(a.position.y - overtakeLane) < 1.3 &&
            Math.abs(a.position.x - ego.position.x) < 45,
        );

        if (isRoadSpaceAvailable && isAdjacentClear) {
          overtakePhase = "PASSING";
          overtakeTargetId = slowVehicle.id;
          return {
            mode: "REPLAN",
            targetSpeed: Math.min(speedLimit, Math.max(ego.speed, slowVehicle.speed + 3.2)),
            targetLateral: overtakeLane, // Move to right lane for overtaking
            reasons: [
              `Slower vehicle ahead (${slowVehicle.label}) in left lane`,
              "Indian traffic rules: Initiating overtake via right lane",
              "Dynamic overtake trajectory engaged into right corridor",
            ],
            lastUpdate: inputs.simTime,
            decisionCount: state.decisionCount + 1,
            overtakePhase: "PASSING",
            overtakeTargetId,
          };
        }
      }
    }
  }

  const cautionTtcThreshold = mode === "ALIENX" ? TTC_COMFORT : TTC_COMFORT * 0.7;
  const hardTtcThreshold = mode === "ALIENX" ? TTC_CAUTION : TTC_CAUTION * 0.75;

  const threat = agents.find((a) => a.id === risk.nearestAgentId);

  // Check if an obstacle or stopped vehicle is physically blocking our lane ahead:
  const isDirectLaneBlock =
    threat &&
    (threat.type === "obstacle" || threat.speed < 0.5) &&
    risk.nearestDistance < 35 &&
    Math.abs(threat.position.y - ego.lateral) < 1.8;

  const hasPathConflict = risk.pathConflict !== "NONE" || Boolean(isDirectLaneBlock);

  // Safe to cruise ONLY if no immediate lane blockage and risk is nominal:
  const isSafeToCruise =
    !isDirectLaneBlock &&
    (risk.nearestAgentId === null || risk.nearestDistance > 25 || risk.closingSpeed <= 0) &&
    risk.level === "SAFE" &&
    (risk.ttc > cautionTtcThreshold || risk.ttc === Infinity) &&
    risk.stoppingMargin > 1.5;

  if (isSafeToCruise) {
    reasons.push("No immediate path conflict");
    reasons.push("TTC above intervention threshold");
    reasons.push("Prediction confidence stable");
    reasons.push("Cruising in left lane (Indian traffic rule compliant)");
    mode2 = "CRUISE";
    targetSpeed = speedLimit;
    targetLateral = nominalLane; // Keep in left lane during normal cruising
  } else {
    reasons.push(
      risk.nearestAgentId ? `Relevant agent tracked · ${risk.nearestAgentId}` : "Elevated uncertainty in scene",
    );
    if (risk.pathConflict !== "NONE") reasons.push(`Predicted trajectory conflict → ${risk.pathConflict}`);
    if (risk.ttc < 99) reasons.push(`TTC decreasing (${risk.ttc.toFixed(1)}s)`);
    if (risk.uncertainty > 0.35) reasons.push("Uncertainty rising");
    if (risk.stoppingMargin < 8) reasons.push(`Stopping margin tight (${risk.stoppingMargin.toFixed(1)}m)`);

    let replanActive = false;

    // Lateral avoidance:
    if (threat && hasPathConflict) {
      if (threat.behavior === "cutIn" || threat.behavior === "crossing") {
        replanActive = true;
        const preferredSide = threat.position.y > ego.lateral ? -1 : 1;
        targetLateral = Math.max(-roadHalfWidth + 1.2, Math.min(roadHalfWidth - 1.2, preferredSide * 1.2));
        reasons.push("Lateral replan evaluated for crossing agent");
      } else if (threat.type === "obstacle" && mode === "ALIENX") {
        // Evaluate if adjacent space has at least 2.4m clearance:
        const leftSpace = -roadHalfWidth - (threat.position.y - threat.radius);
        const rightSpace = roadHalfWidth - (threat.position.y + threat.radius);
        const canPassRight = Math.abs(rightSpace) >= 2.4;
        const canPassLeft = Math.abs(leftSpace) >= 2.4;
        if (canPassRight || canPassLeft) {
          replanActive = true;
          const passSide = canPassRight ? 1 : -1;
          targetLateral = passSide * 1.5;
          targetSpeed = Math.min(speedLimit * 0.6, 25 * MS_PER_KMH);
          mode2 = "REPLAN";
          reasons.push("Static obstacle · Lateral avoidance replan engaged");
        }
      }
    }

    if (!replanActive) {
      targetLateral = nominalLane;
      if (
        isDirectLaneBlock ||
        risk.ttc <= hardTtcThreshold ||
        risk.stoppingMargin <= 0
      ) {
        mode2 = "HOLD";
        targetSpeed = 0;
        reasons.push("Controlled stop initiated before hazard");
      } else {
        mode2 = "CAUTION_SLOW";
        const factor = risk.level === "INTERVENE" ? 0.15 : risk.level === "CAUTION" ? 0.45 : 0.70;
        targetSpeed = Math.max(0, speedLimit * factor);
      }
    }
  }

  return {
    mode: mode2,
    targetSpeed,
    targetLateral,
    reasons,
    lastUpdate: inputs.simTime,
    decisionCount: state.decisionCount + 1,
    overtakePhase,
    overtakeTargetId,
  };
}

export function accelerationForTarget(
  ego: EgoState,
  targetSpeed: number,
  stoppingClearance?: number,
): number {
  const diff = targetSpeed - ego.speed;
  if (diff > 0.15) {
    return Math.min(CRUISE_ACCEL, Math.max(0.4, diff * 0.75));
  }
  if (diff < -0.05) {
    if (targetSpeed === 0) {
      // If already stopped, keep brakes engaged to hold standstill
      if (ego.speed < 0.1) return -0.5;

      // Kinematic required deceleration to stop right at the 3m buffer:
      if (stoppingClearance !== undefined && stoppingClearance > 0) {
        const bufferDist = Math.max(0.4, stoppingClearance);
        const reqDecel = (ego.speed * ego.speed) / (2 * bufferDist);
        return -Math.min(6.0, Math.max(COMFORT_DECEL, reqDecel));
      }
      return -COMFORT_DECEL;
    }
    return -Math.min(COMFORT_DECEL, Math.abs(diff) * 0.9 + 0.6);
  }
  return 0;
}
