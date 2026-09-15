import type { AgentState } from "./types";
import { randRange } from "./seededRandom";

// Advances a single agent's kinematic state for one physics step according
// to its behavior tag. Pure function — returns a new AgentState.
export function updateAgent(agent: AgentState, dt: number, rand: () => number, egoX: number, roadHalfWidth: number): AgentState {
  if (agent.type === "obstacle" || agent.behavior === "static") return agent;

  let { position, heading, speed } = agent;
  let pathIndex = agent.pathIndex;
  let hidden = agent.hidden;

  // Occlusion reveal: as ego approaches, a hidden hazard agent becomes
  // visible to perception once within its configured reveal distance.
  if (hidden && agent.revealDistance !== undefined) {
    const dx = agent.position.x - egoX;
    if (dx < agent.revealDistance) hidden = false;
  }

  switch (agent.behavior) {
    case "ambient": {
      if (agent.path && agent.path.length > 0 && pathIndex !== undefined) {
        const target = agent.path[pathIndex];
        const dx = target.x - position.x;
        const dy = target.y - position.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.4) {
          pathIndex = (pathIndex + 1) % agent.path.length;
        } else {
          heading = Math.atan2(dy, dx);
          position = { x: position.x + Math.cos(heading) * speed * dt, y: position.y + Math.sin(heading) * speed * dt };
        }
      }
      break;
    }
    case "cruise": {
      position = { x: position.x + Math.cos(heading) * speed * dt, y: position.y + Math.sin(heading) * speed * dt };
      break;
    }
    case "crossing": {
      if (agent.path && pathIndex !== undefined && agent.path[pathIndex]) {
        const target = agent.path[pathIndex];
        const dx = target.x - position.x;
        const dy = target.y - position.y;
        const dist = Math.hypot(dx, dy) || 1;
        heading = Math.atan2(dy, dx);
        const step = Math.min(dist, speed * dt);
        position = { x: position.x + Math.cos(heading) * step, y: position.y + Math.sin(heading) * step };
        if (dist < 0.5 && pathIndex < agent.path.length - 1) {
          pathIndex += 1;
        } else if (dist < 0.5) {
          // Continue moving forward off the road onto shoulder/sidewalk
          position = { x: position.x + Math.cos(heading) * speed * dt, y: position.y + Math.sin(heading) * speed * dt };
        }
      } else {
        position = { x: position.x + Math.cos(heading) * speed * dt, y: position.y + Math.sin(heading) * speed * dt };
      }
      break;
    }
    case "cutIn": {
      const targetY = agent.path && agent.path[0] ? agent.path[0].y : 0;
      const dy = targetY - position.y;
      const lateralStep = Math.sign(dy) * Math.min(Math.abs(dy), 0.6 * dt);
      position = { x: position.x + speed * dt, y: position.y + lateralStep };
      break;
    }
    case "erratic": {
      // Cattle crossing with organic wander: advances across the roadway toward the
      // opposite shoulder, with natural slight wandering.
      if (agent.path && pathIndex !== undefined && agent.path[pathIndex]) {
        const target = agent.path[pathIndex];
        const dx = target.x - position.x;
        const dy = target.y - position.y;
        const dist = Math.hypot(dx, dy) || 1;
        const crossAngle = Math.atan2(dy, dx);
        const jitter = randRange(rand, -0.2, 0.2);
        heading = crossAngle + jitter;
        const step = Math.min(dist, speed * dt);
        position = {
          x: position.x + Math.cos(heading) * step,
          y: position.y + Math.sin(heading) * step,
        };
        if (dist < 0.6 && pathIndex < agent.path.length - 1) {
          pathIndex += 1;
        } else if (dist < 0.6) {
          // Already reached opposite shoulder; wander gently on shoulder
          position = {
            x: position.x + randRange(rand, -0.05, 0.15) * dt,
            y: position.y + Math.sign(dy || 1) * 0.2 * dt,
          };
        }
      } else {
        // Fallback: cross toward opposite side of road
        const crossDir = position.y >= 0 ? -1 : 1;
        const jitter = randRange(rand, -0.15, 0.15);
        position = {
          x: position.x + randRange(rand, 0.05, 0.2) * dt,
          y: position.y + (crossDir * speed * 0.8 + jitter) * dt,
        };
        heading = Math.atan2(crossDir * speed * 0.8 + jitter, 0.1);
      }
      break;
    }
  }

  return { ...agent, position, heading, pathIndex, hidden };
}
