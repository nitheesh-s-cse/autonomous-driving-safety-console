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
        if (dist < 0.5 && pathIndex < agent.path.length - 1) pathIndex += 1;
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
      // Cattle-like unpredictable wander: small random lateral jitter with
      // occasional larger excursions, clamped to road bounds.
      const jitter = randRange(rand, -0.35, 0.35) * dt * 4;
      let newY = position.y + jitter;
      newY = Math.max(-roadHalfWidth + 0.5, Math.min(roadHalfWidth - 0.5, newY));
      const forward = randRange(rand, -0.15, 0.25);
      position = { x: position.x + forward * dt * 2, y: newY };
      heading = Math.atan2(jitter, forward || 0.01);
      break;
    }
  }

  return { ...agent, position, heading, pathIndex, hidden };
}
