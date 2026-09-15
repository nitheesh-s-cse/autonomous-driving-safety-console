# ALIEN X — Adaptive Dual-Rate Planning & Safety Framework

An interactive, in-browser autonomous-driving **safety validation console** built for an
SIH-style hackathon demonstration. Everything runs client-side: a deterministic simulation
engine drives a Canvas-rendered driving scene, a 10 Hz planner and an independent 50 Hz
Safety Reflex loop make control decisions, and a command-center UI exposes risk,
explainability, telemetry and event data in real time.

> Simulation-only prototype. Not intended for vehicle control. No real vehicle, sensor feed,
> or backend service is involved — all agents, hazards and physics are simulated in the browser.

## Local setup

```bash
npm install
npm run dev       # start the Vite dev server
```

## Production build

```bash
npm run build      # type-checked, minified production bundle in dist/
npm run preview    # preview the production build locally
```

## Deploying to Vercel

The project is a standard Vite + React + TypeScript app with no backend, environment
variables, or server functions. Push the repository to Git and import it in Vercel — the
default "Vite" framework preset (`npm run build`, output directory `dist`) works out of the box.

## Architecture overview

```
src/
  simulation/
    types.ts               shared type definitions + SimulationDataSource adapter contract
    constants.ts            all tunable physics / timing / risk constants
    seededRandom.ts          deterministic PRNG (mulberry32) for repeatable runs
    scenarios.ts             road + static-object + initial-agent definitions per scenario
    agentModel.ts            per-agent kinematic update (ambient/cruise/crossing/cutIn/erratic)
    vehicleModel.ts          ego vehicle longitudinal + lateral integration
    trajectoryPrediction.ts  constant-velocity agent prediction + ego planned path + conflict test
    riskAssessment.ts        TTC / stopping distance / uncertainty / composite risk score
    planner.ts               10 Hz planner: target speed, lateral offset, decision reasons
    safetyReflex.ts          50 Hz independent safety loop: emergency-braking override
    hazards.ts               hazard-injection factory functions
    metrics.ts               rolling run metrics (avg speed, min TTC, interventions, ...)
    simState.ts              pure fixed-step simulation reducer (stepState) + state init
    engine.ts                SimulationEngine: RAF loop, pub/sub snapshots, demo + comparison
  hooks/useEngine.ts          React hook exposing a stable engine instance + throttled snapshot
  components/                 command-center UI (canvas, panels, controls, charts)
```

### Simulation loop

`SimulationEngine` owns a single `requestAnimationFrame` loop with a fixed-step accumulator
(60 Hz physics). Inside each fixed step:

- Agents are advanced kinematically every step (perception/occlusion resolves continuously).
- Every **100 ms** (10 Hz) the planner tick runs: builds short-horizon predictions for visible
  agents, checks predicted-path conflicts against the ego corridor, and produces a target
  speed / lateral offset with human-readable reasons.
- Every **20 ms** (50 Hz) the Safety Reflex tick runs: recomputes the composite risk state
  (TTC, stopping margin, path conflict, uncertainty, occlusion) and can independently force an
  emergency-braking override regardless of what the planner requested.
- Physics integrates the ego vehicle every 60 Hz step using the latest control output.

The engine publishes a cloned, throttled snapshot to subscribers at ~10 Hz so React panels
don't re-render 60 times a second; `SimulationCanvas` additionally interpolates between the
last two snapshots on its own `requestAnimationFrame` loop so on-screen motion stays smooth.

### Baseline vs ALIEN X

Both modes share the same simulation model but use different thresholds and reflex behaviour:
ALIEN X uses an adaptive risk weighting, an independent high-rate (50 Hz) reflex and an earlier
critical-TTC threshold; Baseline uses a single coarser threshold and a weaker/slower emergency
response. The **Compare** panel runs both strategies offline (not rendered) against an identical
seed, scenario and hazard-injection time, then reports the resulting metrics side by side —
labelled explicitly as *simulated demonstration results*.

### Future data-source adapters

`SimulationDataSource` in `simulation/types.ts` defines the minimal read interface
(`getVehicleState`, `getAgents`, `getPredictions`, `getRiskAssessment`, `getPlannerState`) the UI
actually depends on. The in-browser engine satisfies this shape today; a future
`MatlabSimulationAdapter` / `SimulinkAdapter` / `RecordedRunAdapter` could implement the same
interface so the UI layer does not need to change.

## Simulation assumptions

- Kinematics are a simplified 2D bicycle-free model (longitudinal speed + lateral offset), not a
  full vehicle dynamics model.
- Risk is computed from a transparent weighted combination of TTC, distance, closing speed,
  stopping margin, predicted path conflict, prediction uncertainty and occlusion — there is no
  random risk generation.
- "Collisions" reported in metrics are a simulated threshold marker (severe negative stopping
  margin while still moving under Baseline control), not a physical collision simulation.
- All results are simulated demonstrations for a hackathon prototype and are not a validated
  safety claim about any real vehicle or production system.
# autonomous-driving-safety-console
