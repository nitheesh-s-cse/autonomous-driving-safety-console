import { Panel } from "./Panel";
import type { MetricsState } from "../simulation/types";
import { Sparkline } from "./Sparkline";
import { fmt1 } from "../utils/format";

export interface History {
  speed: number[];
  risk: number[];
  ttc: number[];
  reflexMarkers: boolean[];
}

export function MetricsStrip({ metrics, history }: { metrics: MetricsState; history: History }) {
  return (
    <Panel title="Simulation Performance" className="h-full">
      <div className="flex h-full flex-col gap-3">
        <div className="grid grid-cols-4 gap-x-3 gap-y-3">
          <Stat label="Avg speed" value={fmt1(metrics.avgSpeedKmh)} unit="km/h" />
          <Stat label="Min TTC" value={metrics.minTTC === Infinity ? "∞" : fmt1(metrics.minTTC)} unit="s" />
          <Stat label="Max risk" value={String(Math.round(metrics.maxRisk))} unit="%" />
          <Stat label="Reaction time" value={metrics.reactionTimeMs === null ? "—" : Math.round(metrics.reactionTimeMs).toString()} unit="ms" />
          <Stat label="Interventions" value={String(metrics.interventions)} />
          <Stat label="Collisions" value={String(metrics.collisions)} warn={metrics.collisions > 0} />
          <Stat label="Planner decisions" value={String(metrics.plannerDecisions)} />
          <Stat label="Safety overrides" value={String(metrics.safetyOverrides)} />
        </div>
        <div className="mt-auto grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3">
          <ChartBlock label="Speed" color="#21D4FD" data={history.speed} />
          <ChartBlock label="Risk" color="#FFB547" data={history.risk} />
          <ChartBlock label="TTC" color="#3DDC97" data={history.ttc} markers={history.reflexMarkers} />
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value, unit, warn }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1">
        <span className={`tabular text-[16px] font-semibold leading-none ${warn ? "text-[#FF4D5E]" : "text-[#F4F7FA]"}`}>{value}</span>
        {unit && <span className="text-[10px] text-[#697582]">{unit}</span>}
      </div>
      <span className="text-[9px] uppercase tracking-[0.07em] text-[#697582]">{label}</span>
    </div>
  );
}

function ChartBlock({ label, color, data, markers }: { label: string; color: string; data: number[]; markers?: boolean[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-[0.07em] text-[#697582]">{label}</span>
      <Sparkline data={data} color={color} width={140} height={30} markers={markers} />
    </div>
  );
}
