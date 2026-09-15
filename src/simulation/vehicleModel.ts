import type { EgoState } from "./types";
import { LATERAL_RATE } from "./constants";

export function updateEgo(ego: EgoState, dt: number, acceleration: number, targetLateral: number, emergencyBraking: boolean): EgoState {
  const speed = Math.max(0, ego.speed + acceleration * dt);
  const traveled = ego.traveled + speed * dt;
  const position = { x: ego.position.x + speed * dt, y: ego.lateral };

  const lateralDiff = targetLateral - ego.lateral;
  const lateralStep = Math.sign(lateralDiff) * Math.min(Math.abs(lateralDiff), LATERAL_RATE * dt);
  const lateral = ego.lateral + (Number.isFinite(lateralStep) ? lateralStep : 0);

  const turnSignal: EgoState["turnSignal"] = Math.abs(lateralDiff) > 0.15 ? (lateralDiff > 0 ? "right" : "left") : "none";

  return {
    ...ego,
    speed,
    position: { x: position.x, y: lateral },
    lateral,
    targetLateral,
    acceleration,
    braking: acceleration < -0.3,
    emergencyBraking,
    turnSignal,
    traveled,
  };
}
