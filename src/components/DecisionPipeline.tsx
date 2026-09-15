import { cn } from "../utils/cn";
import type { PipelineStage } from "../simulation/types";

const STAGES: { id: PipelineStage; label: string }[] = [
  { id: "SENSE", label: "Sense" },
  { id: "UNDERSTAND", label: "Understand" },
  { id: "PREDICT", label: "Predict" },
  { id: "PLAN", label: "Plan" },
  { id: "VERIFY", label: "Verify" },
  { id: "REFLEX", label: "Reflex" },
  { id: "ACT", label: "Act" },
];

const STAGE_ORDER: Record<string, number> = {
  SENSE: 0,
  UNDERSTAND: 1,
  PREDICT: 2,
  PLAN: 3,
  VERIFY: 4,
  REFLEX: 5,
  ACT: 6,
};

export function DecisionPipeline({ stage, reflexActive }: { stage: PipelineStage; reflexActive: boolean }) {
  const activeIndex = reflexActive ? STAGE_ORDER["ACT"] : STAGE_ORDER[stage];

  return (
    <div className="flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-[#0b1016] px-4 py-2.5">
      <span className="mr-2 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#697582]">Decision Pipeline</span>
      <div className="flex flex-1 items-center">
        {STAGES.map((s, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          const isReflexStage = s.id === "VERIFY" || s.id === "REFLEX";
          return (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full border transition-all duration-300",
                    isActive && reflexActive && isReflexStage
                      ? "border-[#FF4D5E] bg-[#FF4D5E] animate-ring-pulse"
                      : isActive
                        ? "border-[#21D4FD] bg-[#21D4FD]"
                        : isPast
                          ? "border-[#3B82F6]/60 bg-[#3B82F6]/40"
                          : "border-white/20 bg-transparent",
                  )}
                />
                <span
                  className={cn(
                    "text-[9.5px] font-medium uppercase tracking-wide",
                    isActive ? "text-[#F4F7FA]" : "text-[#697582]",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className={cn("mx-1 h-px flex-1 transition-colors duration-300", isPast ? "bg-[#3B82F6]/50" : "bg-white/10")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
