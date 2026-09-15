import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";
import type { RiskLevel } from "../simulation/types";

export function StatusDot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-1.5 w-1.5">
      {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: color }} />}
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

export function levelColor(level: RiskLevel): string {
  if (level === "SAFE") return "#3DDC97";
  if (level === "CAUTION") return "#FFB547";
  return "#FF4D5E";
}

export function LevelBadge({ level }: { level: RiskLevel }) {
  const color = levelColor(level);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}14` }}
    >
      <StatusDot color={color} />
      {level}
    </span>
  );
}

export function Button({
  children,
  className,
  variant = "default",
  active = false,
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "danger";
  active?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[8px] border font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#21D4FD] disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-[12.5px]",
        variant === "default" &&
          "border-white/[0.1] bg-white/[0.04] text-[#F4F7FA] hover:bg-white/[0.08] active:bg-white/[0.1]",
        variant === "outline" &&
          "border-white/[0.12] bg-transparent text-[#A7B0BA] hover:border-white/[0.22] hover:text-[#F4F7FA]",
        variant === "ghost" && "border-transparent bg-transparent text-[#A7B0BA] hover:bg-white/[0.06] hover:text-[#F4F7FA]",
        variant === "danger" && "border-[#FF4D5E]/30 bg-[#FF4D5E]/10 text-[#FF4D5E] hover:bg-[#FF4D5E]/20",
        active && "border-[#21D4FD]/50 bg-[#21D4FD]/10 text-[#21D4FD]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Metric({ label, value, unit, valueColor }: { label: string; value: ReactNode; unit?: string; valueColor?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1">
        <span className="tabular text-[22px] font-semibold leading-none" style={{ color: valueColor ?? "#F4F7FA" }}>
          {value}
        </span>
        {unit && <span className="text-[11px] text-[#697582]">{unit}</span>}
      </div>
      <span className="text-[10px] uppercase tracking-[0.08em] text-[#697582]">{label}</span>
    </div>
  );
}
