import type { AgentState, EgoState, Prediction, RoadDefinition } from "./types";
import { PREDICTION_HORIZON_S, PREDICTION_STEPS } from "./constants";

// Predicts short-horizon future positions for a dynamic agent using a
// constant-velocity model along its current heading / path intent, with a
// per-type uncertainty growth rate. Agents with higher base uncertainty
// (pedestrians, cattle) grow wider uncertainty cones faster.
export function predictAgent(agent: AgentState): Prediction {
  const points: { x: number; y: number }[] = [];
  const uncertainty: number[] = [];
  const dt = PREDICTION_HORIZON_S / PREDICTION_STEPS;

  let vx = Math.cos(agent.heading) * agent.speed;
  let vy = Math.sin(agent.heading) * agent.speed;

  // Agents actively crossing bias toward their path target for a more
  // representative predicted trajectory than pure heading extrapolation.
  if (agent.path && agent.pathIndex !== undefined && agent.path[agent.pathIndex]) {
    const target = agent.path[agent.pathIndex];
    const dx = target.x - agent.position.x;
    const dy = target.y - agent.position.y;
    const d = Math.hypot(dx, dy) || 1;
    vx = (dx / d) * agent.speed;
    vy = (dy / d) * agent.speed;
  }

  let px = agent.position.x;
  let py = agent.position.y;
  const growth = 0.35 + agent.uncertainty * 1.4; // meters/second^~1 growth of cone

  for (let i = 1; i <= PREDICTION_STEPS; i++) {
    px += vx * dt;
    py += vy * dt;
    points.push({ x: px, y: py });
    uncertainty.push(0.25 + growth * (i * dt) * (agent.hidden ? 1.6 : 1));
  }

  return { agentId: agent.id, points, uncertainty, conflict: false };
}

// Ego planned path: straight-ish projection along the road centerline plus
// current/target lateral offset, used purely for visualization + conflict
// checks against agent predictions.
export function planEgoPath(ego: EgoState, _road: RoadDefinition, horizonS = PREDICTION_HORIZON_S): { x: number; y: number }[] {
  const steps = PREDICTION_STEPS;
  const dt = horizonS / steps;
  const pts: { x: number; y: number }[] = [];
  let x = ego.position.x;
  let lateral = ego.lateral;
  const lateralStep = (ego.targetLateral - ego.lateral) / steps;
  for (let i = 1; i <= steps; i++) {
    x += ego.speed * dt;
    lateral += lateralStep;
    pts.push({ x, y: lateral });
  }
  return pts;
}

// Determines whether an agent's predicted path intersects the ego's
// forward corridor (a lateral band around the planned path), returning a
//0..1 conflict strength used by the risk model.
export function pathConflictStrength(
  egoPath: { x: number; y: number }[],
  prediction: Prediction,
  corridorHalfWidth = 1.3,
): number {
  let maxStrength = 0;
  for (let i = 0; i < egoPath.length; i++) {
    const ep = egoPath[i];
    const pp = prediction.points[i];
    if (!pp) continue;
    const lateralGap = Math.abs(ep.y - pp.y);
    const band = corridorHalfWidth + prediction.uncertainty[i];
    if (lateralGap < band) {
      const strength = 1 - lateralGap / band;
      if (strength > maxStrength) maxStrength = strength;
    }
  }
  return Math.max(0, Math.min(1, maxStrength));
}
