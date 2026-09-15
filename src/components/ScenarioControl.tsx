import { TreePine, Store, Signpost, Milestone, PawPrint } from "lucide-react";
import { Panel } from "./Panel";
import { SCENARIO_ORDER, SCENARIOS } from "../simulation/scenarios";
import type { ScenarioId } from "../simulation/types";
import { cn } from "../utils/cn";

const ICONS: Record<ScenarioId, typeof TreePine> = {
  "village-road": TreePine,
  "dense-market": Store,
  intersection: Signpost,
  "highway-merge": Milestone,
  "cattle-crossing": PawPrint,
};

export function ScenarioControl({ activeId, onSelect }: { activeId: ScenarioId; onSelect: (id: ScenarioId) => void }) {
  return (
    <Panel title="Scenario Control" padded={false}>
      <div className="flex flex-col gap-1 p-2">
        {SCENARIO_ORDER.map((id) => {
          const scenario = SCENARIOS[id];
          const Icon = ICONS[id];
          const active = id === activeId;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={cn(
                "flex items-center gap-2.5 rounded-[8px] border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-[#21D4FD]/45 bg-[#21D4FD]/[0.07]"
                  : "border-transparent hover:border-white/[0.1] hover:bg-white/[0.03]",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border",
                  active ? "border-[#21D4FD]/40 text-[#21D4FD]" : "border-white/[0.1] text-[#697582]",
                )}
              >
                <Icon size={14} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={cn("truncate text-[12.5px] font-medium", active ? "text-[#F4F7FA]" : "text-[#D6DCE2]")}>
                  {scenario.name}
                </span>
                <span className="truncate text-[10.5px] text-[#697582]">{scenario.descriptor}</span>
              </span>
              {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#21D4FD]" />}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
