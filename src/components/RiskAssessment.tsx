import { Panel } from "./Panel";
import { LevelBadge, levelColor } from "./ui";
import type { RiskState } from "../simulation/types";
import { fmt1 } from "../utils/format";
import { Eye, EyeOff } from "lucide-react";

export function RiskAssessment({ risk }: { risk: RiskState }) {
  const color = levelColor(risk.level);
  const pct = Math.min(100, Math.max(0, risk.score));

  return (
    <Panel title="Risk Assessment" right={<LevelBadge level={risk.level} />}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <RiskRing pct={pct} color={color} />
          <div className="flex flex-col gap-1">
            <span className="tabular text-[34px] font-bold leading-none" style={{ color }}>
              {pct}
              <span className="text-[15px] text-[#697582]">%</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#697582]">Composite Risk Score</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-white/[0.06] pt-3">
          <Row label="TTC" value={risk.ttc === Infinity ? "∞" : `${fmt1(risk.ttc)}s`} warn={risk.ttc < 3.5} />
          <Row label="Stopping margin" value={`${risk.stoppingMargin >= 0 ? "+" : ""}${fmt1(risk.stoppingMargin)} m`} warn={risk.stoppingMargin < 0} />
          <Row label="Prediction confidence" value={`${risk.predictionConfidence}%`} />
          <Row label="Path conflict" value={risk.pathConflict} warn={risk.pathConflict === "HIGH"} />
          <div className="col-span-2 flex items-center justify-between">
            <span className="text-[10.5px] text-[#697582]">Occlusion</span>
            <span className={`flex items-center gap-1.5 text-[11px] font-medium ${risk.occlusion ? "text-[#FFB547]" : "text-[#3DDC97]"}`}>
              {risk.occlusion ? <EyeOff size={12} /> : <Eye size={12} />}
              {risk.occlusion ? "Detected" : "Clear"}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10.5px] text-[#697582]">{label}</span>
      <span className={`tabular text-[11.5px] font-medium ${warn ? "text-[#FFB547]" : "text-[#D6DCE2]"}`}>{value}</span>
    </div>
  );
}

function RiskRing({ pct, color }: { pct: number; color: string }) {
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 300ms ease, stroke 300ms ease" }}
      />
    </svg>
  );
}
