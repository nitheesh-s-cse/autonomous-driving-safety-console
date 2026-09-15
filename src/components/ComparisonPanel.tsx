import { useState } from "react";
import { X, Play } from "lucide-react";
import { Button } from "./ui";
import { SCENARIO_ORDER, SCENARIOS } from "../simulation/scenarios";
import { HAZARD_META } from "../simulation/hazards";
import type { HazardType, ScenarioId } from "../simulation/types";
import type { ComparisonRun } from "../simulation/engine";
import { fmt1 } from "../utils/format";

const HAZARDS: HazardType[] = [
  "pedestrian-crossing",
  "twowheeler-cutin",
  "sudden-obstacle",
  "wrongside-vehicle",
  "cattle-crossing",
  "hidden-pedestrian",
];

export function ComparisonPanel({
  onClose,
  onRun,
}: {
  onClose: () => void;
  onRun: (scenario: ScenarioId, hazard: HazardType) => ComparisonRun;
}) {
  const [scenario, setScenario] = useState<ScenarioId>("village-road");
  const [hazard, setHazard] = useState<HazardType>("pedestrian-crossing");
  const [result, setResult] = useState<ComparisonRun | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    // Executed synchronously by the engine, but a microtask defer keeps the
    // click feedback responsive.
    setTimeout(() => {
      const r = onRun(scenario, hazard);
      setResult(r);
      setRunning(false);
    }, 30);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[12px] border border-white/[0.1] bg-[#0b1016] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#F4F7FA]">Control Strategy Comparison</h2>
            <p className="text-[10.5px] text-[#697582]">Simulated demonstration results · identical seed &amp; hazard timing</p>
          </div>
          <button onClick={onClose} className="rounded-[6px] p-1.5 text-[#697582] hover:bg-white/[0.06] hover:text-[#F4F7FA]" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="scrollbar-thin overflow-y-auto p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] uppercase tracking-wide text-[#697582]">Scenario</span>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as ScenarioId)}
                className="rounded-[6px] border border-white/[0.1] bg-[#10161d] px-2 py-1.5 text-[12px] text-[#F4F7FA]"
              >
                {SCENARIO_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {SCENARIOS[id].name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9.5px] uppercase tracking-wide text-[#697582]">Hazard</span>
              <select
                value={hazard}
                onChange={(e) => setHazard(e.target.value as HazardType)}
                className="rounded-[6px] border border-white/[0.1] bg-[#10161d] px-2 py-1.5 text-[12px] text-[#F4F7FA]"
              >
                {HAZARDS.map((h) => {
                  const isDev = HAZARD_META[h]?.underDevelopment;
                  return (
                    <option key={h} value={h} disabled={isDev}>
                      {HAZARD_META[h].label} {isDev ? "— (Under Development)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <Button
              size="sm"
              onClick={run}
              disabled={running || HAZARD_META[hazard]?.underDevelopment}
              className="mt-4"
            >
              <Play size={13} /> {running ? "Running…" : "Run Comparison"}
            </Button>
          </div>

          {result && (
            <div className="overflow-hidden rounded-[8px] border border-white/[0.08]">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-left text-[10px] uppercase tracking-wide text-[#697582]">
                    <th className="px-3 py-2 font-medium">Metric</th>
                    <th className="px-3 py-2 font-medium">Baseline</th>
                    <th className="px-3 py-2 font-medium text-[#21D4FD]">ALIEN X</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  <MetricRow label="Min TTC (s)" a={fmt1(result.baseline.minTTC)} b={fmt1(result.alienx.minTTC)} />
                  <MetricRow label="Max risk (%)" a={result.baseline.maxRisk.toFixed(0)} b={result.alienx.maxRisk.toFixed(0)} />
                  <MetricRow
                    label="Reaction time (ms)"
                    a={result.baseline.reactionTimeMs !== null ? Math.round(result.baseline.reactionTimeMs).toString() : "—"}
                    b={result.alienx.reactionTimeMs !== null ? Math.round(result.alienx.reactionTimeMs).toString() : "—"}
                  />
                  <MetricRow label="Interventions" a={String(result.baseline.interventions)} b={String(result.alienx.interventions)} />
                  <MetricRow label="Collisions" a={String(result.baseline.collisions)} b={String(result.alienx.collisions)} />
                  <MetricRow label="Avg speed (km/h)" a={fmt1(result.baseline.avgSpeedKmh)} b={fmt1(result.alienx.avgSpeedKmh)} />
                  <MetricRow
                    label="Scenario completed"
                    a={result.baseline.scenarioCompleted ? "Yes" : "No"}
                    b={result.alienx.scenarioCompleted ? "Yes" : "No"}
                  />
                </tbody>
              </table>
              <div className="border-t border-white/[0.08] px-3 py-2 text-[10px] text-[#697582]">
                Run seed {result.seed} · 20s window · hazard injected at t=3.0s for both strategies
              </div>
            </div>
          )}

          {!result && (
            <div className="flex h-32 items-center justify-center rounded-[8px] border border-dashed border-white/[0.1] text-[11.5px] text-[#697582]">
              Select a scenario and hazard, then run the comparison.
            </div>
          )}

          <p className="mt-4 text-[10.5px] leading-relaxed text-[#697582]">
            Both runs use an identical random seed, scenario, hazard type and injection time. Results are produced entirely
            by the deterministic simulation model — not scripted values. This is a simulated demonstration only and does
            not constitute validated safety evidence for real-world deployment.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-b border-white/[0.05] last:border-0">
      <td className="px-3 py-2 text-[#A7B0BA]">{label}</td>
      <td className="px-3 py-2 text-[#D6DCE2]">{a}</td>
      <td className="px-3 py-2 font-semibold text-[#21D4FD]">{b}</td>
    </tr>
  );
}
