import { Panel } from "./Panel";
import type { PlannerState, RiskState, SafetyReflexState } from "../simulation/types";
import { cn } from "../utils/cn";

function decisionLabel(reflex: SafetyReflexState, planner: PlannerState): string {
  if (reflex.overrideActive) return "SAFETY REFLEX OVERRIDE";
  if (planner.mode === "REPLAN") return "LATERAL REPLAN";
  if (planner.mode === "CAUTION_SLOW" || planner.mode === "HOLD") return "CONTROLLED DECELERATION";
  return "MAINTAIN CRUISE";
}

export function ExplainabilityPanel({
  risk,
  planner,
  reflex,
}: {
  risk: RiskState;
  planner: PlannerState;
  reflex: SafetyReflexState;
}) {
  const decision = decisionLabel(reflex, planner);
  const color = reflex.overrideActive ? "#FF4D5E" : risk.level === "SAFE" ? "#3DDC97" : "#FFB547";
  const reasons = reflex.overrideActive ? reflex.triggers.length ? reflex.triggers : ["Independent reflex threshold exceeded"] : planner.reasons;

  return (
    <Panel title="Why Did ALIEN X Act?" className="h-full">
      <div className="flex h-full flex-col justify-between gap-3">
        <ul className="flex flex-col gap-1.5">
          {reasons.slice(0, 4).map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-[11.5px] leading-snug text-[#D6DCE2]">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#697582]" />
              {r}
            </li>
          ))}
        </ul>
        <div className={cn("rounded-[8px] border px-3 py-2")} style={{ borderColor: `${color}35`, backgroundColor: `${color}12` }}>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#697582]">Decision</div>
          <div className="tabular text-[13.5px] font-bold" style={{ color }}>
            {decision}
          </div>
        </div>
      </div>
    </Panel>
  );
}
