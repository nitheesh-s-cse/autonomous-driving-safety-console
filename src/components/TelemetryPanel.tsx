import type { EngineSnapshot } from "../simulation/types";
import { fmt1 } from "../utils/format";
import { levelColor } from "./ui";

export function TelemetryPanel({ snapshot }: { snapshot: EngineSnapshot }) {
  const { ego, risk, planner } = snapshot;
  const speedKmh = ego.speed * 3.6;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.06] bg-[#0b1016]/80 px-4 py-2.5">
      <Item label="Speed" value={Math.round(speedKmh)} unit="km/h" />
      <Sep />
      <Item label="TTC" value={risk.ttc === Infinity ? "∞" : fmt1(risk.ttc)} unit="s" color={risk.ttc < 3.5 ? "#FFB547" : undefined} />
      <Sep />
      <Item label="Stopping distance" value={fmt1(risk.stoppingDistance)} unit="m" />
      <Sep />
      <Item label="Risk" value={risk.score} unit="%" color={levelColor(risk.level)} />
      <Sep />
      <Item label="Uncertainty" value={Math.round(risk.uncertainty * 100)} unit="%" />
      <Sep />
      <Item label="Planner" value="10" unit="Hz" />
      <Sep />
      <Item label="Reflex" value="50" unit="Hz" />
      <Sep />
      <Item label="State" value={planner.mode.replace("_", " ")} />
    </div>
  );
}

function Item({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="tabular text-[15px] font-bold leading-none" style={{ color: color ?? "#F4F7FA" }}>
        {value}
      </span>
      {unit && <span className="text-[10px] text-[#697582]">{unit}</span>}
      <span className="ml-1 text-[9.5px] uppercase tracking-[0.06em] text-[#697582]">{label}</span>
    </div>
  );
}

function Sep() {
  return <div className="h-4 w-px bg-white/[0.08]" />;
}
