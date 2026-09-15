import type { MetricsState } from "./types";

export function initMetrics(): MetricsState {
  return {
    elapsed: 0,
    speedSampleSum: 0,
    speedSampleCount: 0,
    avgSpeedKmh: 0,
    minTTC: Infinity,
    maxRisk: 0,
    reactionTimeMs: null,
    interventions: 0,
    collisions: 0,
    plannerDecisions: 0,
    safetyOverrides: 0,
    hazardActiveSince: null,
  };
}

export function updateMetrics(
  m: MetricsState,
  dt: number,
  speedKmh: number,
  ttc: number,
  riskScore: number,
): MetricsState {
  const speedSampleSum = m.speedSampleSum + speedKmh;
  const speedSampleCount = m.speedSampleCount + 1;
  return {
    ...m,
    elapsed: m.elapsed + dt,
    speedSampleSum,
    speedSampleCount,
    avgSpeedKmh: speedSampleSum / speedSampleCount,
    minTTC: ttc < m.minTTC ? ttc : m.minTTC,
    maxRisk: riskScore > m.maxRisk ? riskScore : m.maxRisk,
  };
}
