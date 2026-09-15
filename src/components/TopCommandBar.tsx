import { Pause, Play, RotateCcw, Sparkles, GitCompareArrows } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { Button, StatusDot } from "./ui";
import { formatSimClock } from "../utils/format";
import type { EngineSnapshot } from "../simulation/types";
import { SCENARIOS } from "../simulation/scenarios";

export function TopCommandBar({
  snapshot,
  onPause,
  onResume,
  onReset,
  onDemo,
  onCompare,
}: {
  snapshot: EngineSnapshot;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onDemo: () => void;
  onCompare: () => void;
}) {
  const scenario = SCENARIOS[snapshot.scenarioId];
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0b1016] px-4">
      <div className="flex items-center gap-3">
        <BrandMark />
        <div className="flex flex-col leading-none">
          <span className="text-[14px] font-bold tracking-tight">ALIEN X</span>
          <span className="text-[10px] text-[#697582]">Adaptive Safety Control Center</span>
        </div>
      </div>

      <div className="hidden items-center gap-6 lg:flex">
        <Labeled label="Scenario" value={scenario.name.toUpperCase()} />
        <div className="h-6 w-px bg-white/[0.08]" />
        <Labeled label="Sim Clock" value={formatSimClock(snapshot.simTime)} mono />
        <div className="h-6 w-px bg-white/[0.08]" />
        <Labeled label="Mode" value={snapshot.mode === "ALIENX" ? "ALIEN X" : "BASELINE"} accent={snapshot.mode === "ALIENX"} />
        <div className="h-6 w-px bg-white/[0.08]" />
        <Labeled label="Run" value={snapshot.runId} mono />
      </div>

      <div className="flex items-center gap-2">
        <div className="mr-1 hidden items-center gap-1.5 rounded-full border border-white/[0.1] px-2.5 py-1 sm:flex">
          <StatusDot color={snapshot.running ? "#3DDC97" : "#697582"} pulse={snapshot.running} />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A7B0BA]">
            {snapshot.running ? "Simulation Online" : "Paused"}
          </span>
        </div>
        {snapshot.running ? (
          <Button size="sm" variant="outline" onClick={onPause} aria-label="Pause simulation">
            <Pause size={13} /> Pause
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onResume} aria-label="Resume simulation">
            <Play size={13} /> Resume
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onReset} aria-label="Reset simulation">
          <RotateCcw size={13} /> Reset
        </Button>
        <Button size="sm" variant="outline" onClick={onCompare} aria-label="Open comparison">
          <GitCompareArrows size={13} /> Compare
        </Button>
        <Button size="sm" active={snapshot.demoActive} onClick={onDemo} aria-label="Toggle demo mode">
          <Sparkles size={13} /> {snapshot.demoActive ? "Exit Demo" : "Run Demo"}
        </Button>
      </div>
    </header>
  );
}

function Labeled({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[9px] uppercase tracking-[0.08em] text-[#697582]">{label}</span>
      <span
        className={`text-[12px] font-semibold ${mono ? "tabular" : ""}`}
        style={{ color: accent ? "#21D4FD" : "#F4F7FA" }}
      >
        {value}
      </span>
    </div>
  );
}
