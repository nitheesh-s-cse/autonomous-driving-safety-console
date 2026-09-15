import type { AgentState, ControlMode, EgoState, Prediction, RiskState, StaticObject } from "./types";
import {
  COMFORT_DECEL,
  REACTION_DELAY_S,
  RISK_CAUTION_MAX,
  RISK_SAFE_MAX,
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
// corridor (small lateral tolerance that widens with distance to account
// for crossing agents), returning distance + closing speed data.
function findNearestRelevant(ego: EgoState, agents: AgentState[]) {
  let best: { agent: AgentState; distance: number; closingSpeed: number; lateralGap: number } | null = null;
  for (const a of agents) {
    if (a.hidden) continue;
    const dx = a.position.x - ego.position.x;
    if (dx < -3) continue; // behind ego, not relevant
    const distance = Math.hypot(dx, a.position.y - ego.lateral);
    const vx = Math.cos(a.heading) * a.speed;
    const closingSpeed = ego.speed - vx; // positive = ego catching up / closing
    const lateralGap = Math.abs(a.position.y - ego.lateral);
    const corridor = 2.6 + Math.min(dx, 40) * 0.05;
    if (lateralGap > corridor && a.behavior !== "crossing" && a.behavior !== "cutIn" && a.behavior !== "erratic") {
      continue;
    }
    if (!best || distance < best.distance) {
      best = { agent: a, distance, closingSpeed, lateralGap };
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
    nearestDistance = Math.max(0, nearest.distance);
    closingSpeed = nearest.closingSpeed;
    nearestAgentId = nearest.agent.id;
    ttc = closingSpeed > 0.15 ? nearestDistance / closingSpeed : Infinity;
    stoppingMargin = nearestDistance - sDist;
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

  // Uncertainty: weighted by nearest relevant agent's base uncertainty and
  // whether it (or any conflicting agent) is currently occluded.
  let uncertainty = nearest ? nearest.agent.uncertainty : 0.08;
  if (occlusion) uncertainty = Math.min(1, uncertainty + 0.35);

  // --- Normalized risk sub-scores (0..1) -----------------------------------
  const ttcRisk = ttc === Infinity ? 0 : Math.max(0, Math.min(1, 1 - ttc / 6));
  const distanceRisk = nearestDistance === Infinity ? 0 : Math.max(0, Math.min(1, 1 - nearestDistance / 50));
  const closingRisk = Math.max(0, Math.min(1, closingSpeed / 14));
  const marginRisk = stoppingMargin >= 15 ? 0 : Math.max(0, Math.min(1, (15 - stoppingMargin) / 25));
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

  // Baseline mode has coarser, less adaptive uncertainty handling — small
  // conflicts are under-weighted until they become severe, which is the
  // whole point of the comparison (later reaction, lower situational score
  // resolution).
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
