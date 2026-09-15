import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Panel } from "./Panel";
import type { PlannerState, SafetyReflexState } from "../simulation/types";
import { cn } from "../utils/cn";

export function SafetyReflexPanel({ reflex, planner }: { reflex: SafetyReflexState; planner: PlannerState }) {
  const active = reflex.status === "ACTIVE";
  return (
    <Panel
      className={cn("transition-colors duration-300", active && "border-[#FF4D5E]/50")}
      title="Safety Reflex"
      right={
        <span
          className={cn(
            "flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide",
            active ? "text-[#FF4D5E]" : "text-[#3DDC97]",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-[#FF4D5E] animate-ring-pulse" : "bg-[#3DDC97]")} />
          {active ? "Reflex Active" : "Monitoring"}
        </span>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-2">
          <RateCard label="Planner" hz={10} colorClass="text-[#3B82F6]" pulsing={planner.mode !== "CRUISE"} />
          <RateCard label="Safety Reflex" hz={50} colorClass={active ? "text-[#FF4D5E]" : "text-[#3DDC97]"} pulsing />
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/[0.06] pt-3 text-[11px]">
          <InfoRow label="Control loop" value="50 Hz" />
          <InfoRow
            label="Stopping margin"
            value={reflex.stoppingMarginState}
            valueClass={
              reflex.stoppingMarginState === "NOMINAL"
                ? "text-[#3DDC97]"
                : reflex.stoppingMarginState === "TIGHT"
                  ? "text-[#FFB547]"
                  : "text-[#FF4D5E]"
            }
          />
          <InfoRow label="Override" value={reflex.overrideActive ? "ENGAGED" : "STANDBY"} valueClass={reflex.overrideActive ? "text-[#FF4D5E]" : "text-[#697582]"} />
          <InfoRow label="Activations" value={String(reflex.activationCount)} />
        </div>

        {active && (
          <div className="rounded-[8px] border border-[#FF4D5E]/30 bg-[#FF4D5E]/[0.08] px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#FF4D5E]">
              <ShieldAlert size={13} /> Trigger
            </div>
            <div className="flex flex-wrap gap-1.5">
              {reflex.triggers.map((t) => (
                <span key={t} className="rounded-[4px] bg-[#FF4D5E]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#FF4D5E]">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-2 text-[11.5px] font-semibold text-[#F4F7FA]">ACTION → EMERGENCY BRAKING</div>
          </div>
        )}
        {!active && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-[#697582]">
            <ShieldCheck size={13} className="text-[#3DDC97]" /> Independent high-rate loop nominal
          </div>
        )}
      </div>
    </Panel>
  );
}

function RateCard({ label, hz, colorClass, pulsing }: { label: string; hz: number; colorClass: string; pulsing?: boolean }) {
  return (
    <div className="rounded-[8px] border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", pulsing && "animate-pulse-soft", colorClass.replace("text-", "bg-"))} />
        <span className="text-[10px] uppercase tracking-[0.06em] text-[#697582]">{label}</span>
      </div>
      <div className={cn("tabular text-[20px] font-bold leading-tight", colorClass)}>
        {hz}
        <span className="ml-1 text-[11px] font-medium text-[#697582]">Hz</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#697582]">{label}</span>
      <span className={cn("tabular font-medium", valueClass ?? "text-[#D6DCE2]")}>{value}</span>
    </div>
  );
}
