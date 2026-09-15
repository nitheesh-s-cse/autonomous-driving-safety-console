import { useEffect, useRef, useState } from "react";
import { useEngine } from "./hooks/useEngine";
import { TopCommandBar } from "./components/TopCommandBar";
import { SimulationCanvas } from "./components/SimulationCanvas";
import { TelemetryPanel } from "./components/TelemetryPanel";
import { DecisionPipeline } from "./components/DecisionPipeline";
import { ModeSwitch } from "./components/ModeSwitch";
import { RiskAssessment } from "./components/RiskAssessment";
import { SafetyReflexPanel } from "./components/SafetyReflexPanel";
import { ScenarioControl } from "./components/ScenarioControl";
import { HazardControl } from "./components/HazardControl";
import { ExplainabilityPanel } from "./components/ExplainabilityPanel";
import { EventLog } from "./components/EventLog";
import { MetricsStrip, type History } from "./components/MetricsStrip";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { LayersMenu } from "./components/LayersMenu";
import { Radar, Route, ShieldHalf, Eye, Crosshair } from "lucide-react";
import type { VisualizationLayers } from "./simulation/types";

const HISTORY_LEN = 150;

export default function App() {
  const { engine, snapshot } = useEngine();
  const [viewMode, setViewMode] = useState<"FOLLOW" | "OVERVIEW">("FOLLOW");
  const [layers, setLayers] = useState<VisualizationLayers>(engine.getLayers());
  const [compareOpen, setCompareOpen] = useState(false);

  const historyRef = useRef<History>({ speed: [], risk: [], ttc: [], reflexMarkers: [] });

  useEffect(() => {
    const h = historyRef.current;
    h.speed.push(snapshot.ego.speed * 3.6);
    h.risk.push(snapshot.risk.score);
    h.ttc.push(Number.isFinite(snapshot.risk.ttc) ? Math.min(snapshot.risk.ttc, 12) : 12);
    h.reflexMarkers.push(snapshot.reflex.overrideActive);
    if (h.speed.length > HISTORY_LEN) {
      h.speed.shift();
      h.risk.shift();
      h.ttc.shift();
      h.reflexMarkers.shift();
    }
  }, [snapshot]);

  const handleLayerChange = (partial: Partial<VisualizationLayers>) => {
    const next = { ...layers, ...partial };
    setLayers(next);
    engine.setLayers(next);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#070a0e] text-[#F4F7FA]">
      <TopCommandBar
        snapshot={snapshot}
        onPause={() => engine.pause()}
        onResume={() => engine.resume()}
        onReset={() => engine.reset(false)}
        onDemo={() => (snapshot.demoActive ? engine.exitDemo() : engine.startDemo())}
        onCompare={() => setCompareOpen(true)}
      />

      <main className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
        {/* Left / center workspace */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-white/[0.08] bg-[#0b1016]">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
              <div className="flex items-center gap-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A7B0BA]">Live Environment</h2>
                <div className="hidden items-center gap-1.5 sm:flex">
                  <Chip icon={<Radar size={11} />} label="Perception Active" color="#21D4FD" />
                  <Chip icon={<Route size={11} />} label="Planner 10 Hz" color="#3B82F6" />
                  <Chip icon={<ShieldHalf size={11} />} label="Reflex 50 Hz" color={snapshot.reflex.overrideActive ? "#FF4D5E" : "#3DDC97"} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode((v) => (v === "FOLLOW" ? "OVERVIEW" : "FOLLOW"))}
                  className="flex items-center gap-1.5 rounded-[6px] border border-white/[0.1] px-2.5 py-1 text-[11px] font-medium text-[#A7B0BA] hover:border-white/[0.2] hover:text-[#F4F7FA]"
                >
                  <Crosshair size={12} /> {viewMode}
                </button>
                <LayersMenu layers={layers} onChange={handleLayerChange} />
              </div>
            </div>
            <div className="relative min-h-0 flex-1">
              <SimulationCanvas engine={engine} viewMode={viewMode} />
              {!snapshot.running && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="rounded-[8px] border border-white/20 bg-[#0b1016]/90 px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-[#F4F7FA]">
                    Simulation Paused
                  </span>
                </div>
              )}
              {snapshot.risk.occlusion && (
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-[6px] border border-[#FFB547]/40 bg-[#0b1016]/85 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#FFB547]">
                  <Eye size={12} /> Occlusion Detected
                </div>
              )}
            </div>
            <TelemetryPanel snapshot={snapshot} />
          </div>

          <DecisionPipeline stage={snapshot.pipelineStage} reflexActive={snapshot.reflex.overrideActive} />
        </div>

        {/* Right operations rail */}
        <div className="scrollbar-thin flex w-[360px] shrink-0 flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between rounded-[12px] border border-white/[0.08] bg-[#0b1016] px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A7B0BA]">Control Strategy</span>
            <ModeSwitch mode={snapshot.mode} onChange={(m) => engine.setMode(m)} />
          </div>
          <RiskAssessment risk={snapshot.risk} />
          <SafetyReflexPanel reflex={snapshot.reflex} planner={snapshot.planner} />
          <ScenarioControl activeId={snapshot.scenarioId} onSelect={(id) => engine.setScenario(id)} />
          <HazardControl onInject={(h) => engine.injectHazard(h)} />
        </div>
      </main>

      {/* Bottom telemetry strip */}
      <section className="grid h-[210px] shrink-0 grid-cols-3 gap-3 px-3 pb-2">
        <ExplainabilityPanel risk={snapshot.risk} planner={snapshot.planner} reflex={snapshot.reflex} />
        <EventLog events={snapshot.events} />
        <MetricsStrip metrics={snapshot.metrics} history={historyRef.current} />
      </section>

      <footer className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-4 py-1.5 text-[9.5px] text-[#697582]">
        <span>ALIEN X — Interactive Autonomous Driving Safety Simulation · Prototype for SIH Internal Hackathon</span>
        <span className="font-semibold uppercase tracking-wide text-[#FFB547]/80">
          Simulation-only • Not for vehicle control
        </span>
      </footer>

      {compareOpen && (
        <ComparisonPanel onClose={() => setCompareOpen(false)} onRun={(scenario, hazard) => engine.runComparison(scenario, hazard)} />
      )}
    </div>
  );
}

function Chip({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span
      className="flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide"
      style={{ color, borderColor: `${color}35`, backgroundColor: `${color}10` }}
    >
      {icon} {label}
    </span>
  );
}
