import type { AgentState, ControlMode, EgoState, Prediction, RiskState, StaticObject } from "./types";
import {
  COMFORT_DECEL,
  EGO_HALF_LENGTH,
  REACTION_DELAY_S,
  RISK_CAUTION_MAX,
  RISK_SAFE_MAX,
  SAFE_STOPPING_BUFFER,
} from "./constants";
import { pathConflictStrength, planEgoPath } from "./trajectoryPrediction";
import type { RoadDefinition } from "./types";

export interface RiskInputs {
  ego: EgoState;
  agents: AgentState[];
  predictions: Prediction[];
  road: RoadDefinition;
  staticObjects: StaticObject[];
  mode: ControlMode;
}

function stoppingDistance(speed: number): number {
  const reactionDistance = speed * REACTION_DELAY_S;
  const brakingDistance = (speed * speed) / (2 * COMFORT_DECEL);
  return reactionDistance + brakingDistance;
}

// Finds the most safety-relevant agent ahead of the ego within its travel
// corridor, returning true physical bumper-to-agent gap + closing speed data.
function findNearestRelevant(ego: EgoState, agents: AgentState[]) {
  let best: { agent: AgentState; physicalClearance: number; distance: number; closingSpeed: number; lateralGap: number } | null = null;
  const frontBumperX = ego.position.x + EGO_HALF_LENGTH;

  for (const a of agents) {
    if (a.hidden) continue;

    const agentFrontX = a.position.x - a.radius;
    const longitudinalGap = agentFrontX - frontBumperX;
    const lateralGap = Math.abs(a.position.y - ego.lateral);

    // If agent has already passed behind the front bumper and is laterally clear, ignore
    if (longitudinalGap < -0.4 && lateralGap > 1.3) continue;
    // If agent is completely behind the ego vehicle, ignore
    if (a.position.x - ego.position.x < -EGO_HALF_LENGTH) continue;

    const vy = Math.sin(a.heading) * a.speed;
    const movingAwayLaterally = (a.position.y - ego.lateral) * vy > 0;

    // Corridor determination:
    const corridor = 2.2 + Math.min(Math.max(0, longitudinalGap), 40) * 0.04;

    if (a.behavior === "crossing" || a.behavior === "erratic") {
      // If the agent has already crossed past ego's lane and is moving away,
      // or is well outside the travel lane (> 3.0m), it has cleared the corridor!
      if (lateralGap > 3.0 || (lateralGap > 1.8 && movingAwayLaterally)) {
        continue;
      }
    } else if (a.behavior === "cutIn") {
      if (lateralGap > 3.2) continue;
    } else {
      if (lateralGap > corridor) continue;
    }

    const physicalClearance = Math.max(0, longitudinalGap);
    const distance = Math.hypot(physicalClearance, lateralGap);
    const vx = Math.cos(a.heading) * a.speed;
    const closingSpeed = ego.speed - vx; // positive = ego closing in

    if (!best || physicalClearance < best.physicalClearance) {
      best = { agent: a, physicalClearance, distance, closingSpeed, lateralGap };
    }
  }
  return best;
}

export function assessRisk(inputs: RiskInputs): RiskState {
  const { ego, agents, predictions, road, mode } = inputs;
  const nearest = findNearestRelevant(ego, agents);

  const sDist = stoppingDistance(ego.speed);

  let ttc = Infinity;
  let closingSpeed = 0;
  let nearestDistance = Infinity;
  let nearestAgentId: string | null = null;
  let stoppingMargin = 999;

  if (nearest) {
    nearestDistance = nearest.physicalClearance;
    closingSpeed = nearest.closingSpeed;
    nearestAgentId = nearest.agent.id;
    ttc = closingSpeed > 0.15 ? nearestDistance / closingSpeed : Infinity;
    // Stopping margin relative to the required SAFE_STOPPING_BUFFER (3m)
    stoppingMargin = nearestDistance - sDist - SAFE_STOPPING_BUFFER;
  }

  // Path conflict from predicted trajectories intersecting ego corridor.
  const egoPath = planEgoPath(ego, road);
  let pathConflictScore = 0;
  for (const p of predictions) {
    const strength = pathConflictStrength(egoPath, p);
    if (strength > pathConflictScore) pathConflictScore = strength;
  }

  // Occlusion: any hidden agent within detection horizon of ego position.
  const occlusion = agents.some((a) => a.hidden && a.position.x - ego.position.x < 45 && a.position.x - ego.position.x > -5);

  // Uncertainty: weighted by nearest relevant agent's base uncertainty
  let uncertainty = nearest ? nearest.agent.uncertainty : 0.08;
  if (occlusion) uncertainty = Math.min(1, uncertainty + 0.35);

  // --- Normalized risk sub-scores (0..1) -----------------------------------
  const ttcRisk = ttc === Infinity ? 0 : Math.max(0, Math.min(1, 1 - ttc / 6));
  const distanceRisk = nearestDistance === Infinity ? 0 : Math.max(0, Math.min(1, 1 - nearestDistance / 50));
  const closingRisk = Math.max(0, Math.min(1, closingSpeed / 14));
  const marginRisk = stoppingMargin >= 10 ? 0 : Math.max(0, Math.min(1, (10 - stoppingMargin) / 20));
  const conflictRisk = pathConflictScore;
  const uncertaintyRisk = uncertainty;
  const occlusionRisk = occlusion ? 1 : 0;

  const weights = {
    ttc: 0.26,
    distance: 0.12,
    closing: 0.12,
    margin: 0.22,
    conflict: 0.16,
    uncertainty: 0.08,
    occlusion: 0.04,
  };

  const raw =
    ttcRisk * weights.ttc +
    distanceRisk * weights.distance +
    closingRisk * weights.closing +
    marginRisk * weights.margin +
    conflictRisk * weights.conflict +
    uncertaintyRisk * weights.uncertainty +
    occlusionRisk * weights.occlusion;

  let score = Math.round(Math.max(0, Math.min(1, raw)) * 100);

  // If the vehicle is already safely stopped with adequate buffer before the obstacle,
  // cap score so system stays in stable HOLD without false collision alarms
  if (ego.speed < 0.2 && nearest && nearestDistance >= SAFE_STOPPING_BUFFER * 0.8) {
    score = Math.min(score, 45); // Controlled hold, not emergency crash
  }

  if (mode === "BASELINE") {
    score = Math.round(score * (conflictRisk > 0.6 ? 1.05 : 0.82));
    score = Math.max(0, Math.min(100, score));
  }

  const level = score < RISK_SAFE_MAX ? "SAFE" : score < RISK_CAUTION_MAX ? "CAUTION" : "INTERVENE";

  const pathConflict =
    pathConflictScore < 0.05 ? "NONE" : pathConflictScore < 0.35 ? "LOW" : pathConflictScore < 0.65 ? "MEDIUM" : "HIGH";

  const predictionConfidence = Math.round((1 - uncertainty) * 100);

  return {
    score,
    level,
    ttc,
    stoppingDistance: sDist,
    stoppingMargin,
    uncertainty,
    pathConflict,
    occlusion,
    closingSpeed,
    nearestAgentId,
    nearestDistance,
    predictionConfidence,
  };
}
