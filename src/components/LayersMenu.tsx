import { useState } from "react";
import { Layers, ChevronDown } from "lucide-react";
import type { VisualizationLayers } from "../simulation/types";
import { cn } from "../utils/cn";

const LABELS: { key: keyof VisualizationLayers; label: string }[] = [
  { key: "detections", label: "Detections" },
  { key: "predictions", label: "Predictions" },
  { key: "plannedPath", label: "Planned Path" },
  { key: "riskZones", label: "Risk Zones" },
  { key: "objectLabels", label: "Object Labels" },
];

export function LayersMenu({ layers, onChange }: { layers: VisualizationLayers; onChange: (l: Partial<VisualizationLayers>) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-[6px] border border-white/[0.1] px-2.5 py-1 text-[11px] font-medium text-[#A7B0BA] hover:border-white/[0.2] hover:text-[#F4F7FA]"
      >
        <Layers size={12} /> Layers <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-[8px] border border-white/[0.1] bg-[#10161d] p-1.5 shadow-xl">
            {LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onChange({ [key]: !layers[key] })}
                className="flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-left text-[11.5px] text-[#D6DCE2] hover:bg-white/[0.05]"
              >
                {label}
                <span
                  className={cn(
                    "h-3.5 w-3.5 rounded-[3px] border",
                    layers[key] ? "border-[#21D4FD] bg-[#21D4FD]/30" : "border-white/20",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
