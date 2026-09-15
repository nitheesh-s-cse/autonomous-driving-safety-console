import { useState } from "react";
import { PersonStanding, Bike, TriangleAlert, CarFront, PawPrint, EyeOff, Check } from "lucide-react";
import { Panel } from "./Panel";
import type { HazardType } from "../simulation/types";
import { HAZARD_META } from "../simulation/hazards";
import { cn } from "../utils/cn";

const ICONS: Record<HazardType, typeof PersonStanding> = {
  "pedestrian-crossing": PersonStanding,
  "twowheeler-cutin": Bike,
  "sudden-obstacle": TriangleAlert,
  "wrongside-vehicle": CarFront,
  "cattle-crossing": PawPrint,
  "hidden-pedestrian": EyeOff,
};

const ORDER: HazardType[] = [
  "pedestrian-crossing",
  "twowheeler-cutin",
  "sudden-obstacle",
  "wrongside-vehicle",
  "cattle-crossing",
  "hidden-pedestrian",
];

export function HazardControl({ onInject, disabled }: { onInject: (h: HazardType) => string; disabled?: boolean }) {
  const [confirm, setConfirm] = useState<{ hazard: HazardType; label: string } | null>(null);

  const handleClick = (h: HazardType) => {
    const agentLabel = onInject(h);
    setConfirm({ hazard: h, label: agentLabel });
    window.setTimeout(() => setConfirm((c) => (c?.hazard === h ? null : c)), 1600);
  };

  return (
    <Panel title="Inject Hazard" padded={false}>
      <div className="grid grid-cols-2 gap-1.5 p-2">
        {ORDER.map((h) => {
          const Icon = ICONS[h];
          const isConfirming = confirm?.hazard === h;
          return (
            <button
              key={h}
              disabled={disabled}
              onClick={() => handleClick(h)}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-[8px] border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                isConfirming
                  ? "border-[#3DDC97]/50 bg-[#3DDC97]/[0.08]"
                  : "border-white/[0.09] hover:border-white/[0.18] hover:bg-white/[0.03]",
              )}
            >
              <span className="flex w-full items-center justify-between">
                <Icon size={14} className={isConfirming ? "text-[#3DDC97]" : "text-[#A7B0BA]"} />
                {isConfirming && <Check size={12} className="text-[#3DDC97]" />}
              </span>
              <span className="text-[11px] font-medium leading-tight text-[#D6DCE2]">{HAZARD_META[h].label}</span>
              {isConfirming ? (
                <span className="text-[9.5px] font-semibold uppercase tracking-wide text-[#3DDC97]">
                  Injected · {confirm.label}
                </span>
              ) : (
                <span className="text-[9.5px] leading-tight text-[#697582]">{HAZARD_META[h].description}</span>
              )}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
