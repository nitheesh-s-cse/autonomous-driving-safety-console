import { useState } from "react";
import {
  PersonStanding,
  Bike,
  TriangleAlert,
  CarFront,
  PawPrint,
  EyeOff,
  Check,
  Construction,
} from "lucide-react";
import { Panel } from "./Panel";
import type { HazardType } from "../simulation/types";
import { HAZARD_META, ACTIVE_HAZARDS, DEV_HAZARDS } from "../simulation/hazards";
import { cn } from "../utils/cn";

const ICONS: Record<HazardType, typeof PersonStanding> = {
  "pedestrian-crossing": PersonStanding,
  "twowheeler-cutin": Bike,
  "sudden-obstacle": TriangleAlert,
  "wrongside-vehicle": CarFront,
  "cattle-crossing": PawPrint,
  "hidden-pedestrian": EyeOff,
};

export function HazardControl({
  onInject,
  disabled,
}: {
  onInject: (h: HazardType) => string;
  disabled?: boolean;
}) {
  const [confirm, setConfirm] = useState<{ hazard: HazardType; label: string } | null>(null);

  const handleClick = (h: HazardType) => {
    if (HAZARD_META[h]?.underDevelopment) return;
    const agentLabel = onInject(h);
    setConfirm({ hazard: h, label: agentLabel });
    window.setTimeout(() => setConfirm((c) => (c?.hazard === h ? null : c)), 1600);
  };

  return (
    <Panel
      title="Inject Hazard"
      padded={false}
      right={
        <div className="flex items-center gap-1.5">
          <span className="flex h-1.5 w-1.5 rounded-full bg-[#3DDC97] animate-pulse" />
          <span className="text-[9px] font-mono uppercase tracking-wider text-[#3DDC97]">
            2 Active
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-2 p-2">
        {/* Active Hazards: Pedestrian Crossing & Two-Wheeler Cut-In */}
        <div>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#A7B0BA]">
              Ready to Inject
            </span>
            <span className="text-[9px] text-[#3DDC97] font-medium">Interactive</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ACTIVE_HAZARDS.map((h) => {
              const Icon = ICONS[h];
              const isConfirming = confirm?.hazard === h;
              return (
                <button
                  key={h}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleClick(h)}
                  className={cn(
                    "group relative flex flex-col items-start gap-1.5 rounded-[8px] border px-2.5 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40",
                    isConfirming
                      ? "border-[#3DDC97]/60 bg-[#3DDC97]/[0.1] ring-1 ring-[#3DDC97]/30"
                      : "border-white/[0.1] bg-white/[0.02] hover:border-[#21D4FD]/40 hover:bg-[#21D4FD]/[0.04]",
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <Icon
                      size={14}
                      className={cn(
                        "transition-colors",
                        isConfirming
                          ? "text-[#3DDC97]"
                          : "text-[#21D4FD] group-hover:text-[#F4F7FA]",
                      )}
                    />
                    {isConfirming ? (
                      <Check size={12} className="text-[#3DDC97]" />
                    ) : (
                      <span className="rounded bg-[#3DDC97]/15 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[#3DDC97]">
                        Active
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-[#D6DCE2] group-hover:text-[#F4F7FA]">
                    {HAZARD_META[h].label}
                  </span>
                  {isConfirming ? (
                    <span className="text-[9.5px] font-semibold uppercase tracking-wide text-[#3DDC97]">
                      Injected · {confirm.label}
                    </span>
                  ) : (
                    <span className="text-[9.5px] leading-tight text-[#8E99A5]">
                      {HAZARD_META[h].description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Under Development Hazards */}
        <div className="pt-0.5">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#697582]">
              <Construction size={11} className="text-[#FFB547]/80" />
              Under Development
            </span>
            <span className="rounded bg-[#FFB547]/10 px-1.5 py-0.5 text-[8px] font-mono font-medium uppercase tracking-wider text-[#FFB547]/90 border border-[#FFB547]/20">
              In Dev
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {DEV_HAZARDS.map((h) => {
              const Icon = ICONS[h];
              return (
                <button
                  key={h}
                  type="button"
                  disabled={true}
                  title="This hazard simulation model is under development"
                  className="flex flex-col items-start gap-1.5 rounded-[8px] border border-dashed border-white/[0.07] bg-white/[0.01] px-2.5 py-2 text-left opacity-60 cursor-not-allowed select-none"
                >
                  <span className="flex w-full items-center justify-between">
                    <Icon size={14} className="text-[#697582]" />
                    <span className="rounded bg-white/[0.05] px-1 py-0.5 text-[7.5px] font-mono uppercase tracking-wider text-[#697582] border border-white/[0.05]">
                      Locked
                    </span>
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-[#8E99A5]">
                    {HAZARD_META[h].label}
                  </span>
                  <span className="text-[9.5px] leading-tight text-[#55606D]">
                    {HAZARD_META[h].description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}
