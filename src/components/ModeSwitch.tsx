import type { ControlMode } from "../simulation/types";
import { cn } from "../utils/cn";

export function ModeSwitch({ mode, onChange }: { mode: ControlMode; onChange: (m: ControlMode) => void }) {
  return (
    <div className="flex rounded-[8px] border border-white/[0.1] bg-white/[0.03] p-0.5 text-[11px] font-semibold">
      {(["BASELINE", "ALIENX"] as ControlMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "rounded-[6px] px-3 py-1.5 transition-colors",
            mode === m ? "bg-[#21D4FD]/[0.12] text-[#21D4FD]" : "text-[#697582] hover:text-[#A7B0BA]",
          )}
        >
          {m === "ALIENX" ? "ALIEN X" : "BASELINE"}
        </button>
      ))}
    </div>
  );
}
