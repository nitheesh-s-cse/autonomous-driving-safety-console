import type { AgentState, ScenarioDefinition, StaticObject } from "./types";
import { randRange, randInt } from "./seededRandom";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${String(idCounter).padStart(2, "0")}`;
}
export function resetIdCounter() {
  idCounter = 0;
}

function agent(partial: Omit<AgentState, "spawnTime"> & { spawnTime?: number }): AgentState {
  return { spawnTime: 0, ...partial };
}

// ---------------------------------------------------------------------------
// Village Road
// ---------------------------------------------------------------------------
const villageRoad: ScenarioDefinition = {
  id: "village-road",
  name: "Village Road",
  descriptor: "Unstructured • Mixed traffic",
  speedLimitKmh: 40,
  road: { length: 1400, width: 9, laneCount: 2, hasLaneMarkings: false, shoulder: 3.5, curvature: 2.4 },
  staticObjects: (() => {
    const objs: StaticObject[] = [];
    for (let x = 30; x < 1400; x += randInt(() => Math.random(), 55, 90)) {
      const side = Math.random() > 0.5 ? 1 : -1;
      objs.push({
        id: nextId("obj"),
        type: Math.random() > 0.6 ? "tree" : "pole",
        position: { x, y: side * (6.5 + Math.random() * 2) },
        width: 1.2,
        height: 1.2,
      });
    }
    return objs;
  })(),
  initialAgents: () => {
    const list: AgentState[] = [];
    list.push(
      agent({
        id: nextId("B"),
        label: "B-01",
        type: "bike",
        position: { x: 70, y: -1.4 },
        heading: 0,
        speed: 6.4,
        radius: 0.7,
        behavior: "cruise",
        uncertainty: 0.18,
        hidden: false,
      }),
    );
    list.push(
      agent({
        id: nextId("P"),
        label: "P-01",
        type: "pedestrian",
        position: { x: 55, y: 5.4 },
        heading: Math.PI,
        speed: 1.1,
        radius: 0.35,
        behavior: "ambient",
        uncertainty: 0.3,
        hidden: false,
        path: [
          { x: 55, y: 5.4 },
          { x: 40, y: 5.6 },
          { x: 25, y: 5.2 },
        ],
        pathIndex: 0,
      }),
    );
    list.push(
      agent({
        id: nextId("V"),
        label: "V-01",
        type: "vehicle",
        position: { x: 140, y: 1.3 },
        heading: 0,
        speed: 8.3,
        radius: 1.1,
        behavior: "cruise",
        uncertainty: 0.12,
        hidden: false,
      }),
    );
    return list;
  },
};

// ---------------------------------------------------------------------------
// Dense Market
// ---------------------------------------------------------------------------
const denseMarket: ScenarioDefinition = {
  id: "dense-market",
  name: "Dense Market",
  descriptor: "Narrow lane • High pedestrian density",
  speedLimitKmh: 20,
  road: { length: 1200, width: 6, laneCount: 2, hasLaneMarkings: false, shoulder: 1.8, curvature: 1.1 },
  staticObjects: (() => {
    const objs: StaticObject[] = [];
    for (let x = 20; x < 1200; x += randInt(() => Math.random(), 22, 34)) {
      const side = Math.random() > 0.5 ? 1 : -1;
      objs.push({
        id: nextId("stall"),
        type: "stall",
        position: { x, y: side * (3.6 + Math.random() * 1.2) },
        width: 2.2,
        height: 1.6,
        occludes: true,
      });
    }
    return objs;
  })(),
  initialAgents: (rand) => {
    const list: AgentState[] = [];
    for (let i = 0; i < 5; i++) {
      const side = rand() > 0.5 ? 1 : -1;
      const x = 40 + i * 26 + randRange(rand, -6, 6);
      list.push(
        agent({
          id: nextId("P"),
          label: `P-0${i + 1}`,
          type: "pedestrian",
          position: { x, y: side * randRange(rand, 1.6, 2.6) },
          heading: side > 0 ? Math.PI : 0,
          speed: randRange(rand, 0.6, 1.2),
          radius: 0.35,
          behavior: "ambient",
          uncertainty: 0.35,
          hidden: false,
          path: [
            { x, y: side * 2.4 },
            { x: x - 12, y: side * 2.2 },
            { x: x - 24, y: side * 2.5 },
          ],
          pathIndex: 0,
        }),
      );
    }
    list.push(
      agent({
        id: nextId("V"),
        label: "V-01",
        type: "vehicle",
        position: { x: 90, y: -0.6 },
        heading: 0,
        speed: 3.6,
        radius: 1.1,
        behavior: "cruise",
        uncertainty: 0.15,
        hidden: false,
      }),
    );
    return list;
  },
};

// ---------------------------------------------------------------------------
// Unsignalized Intersection
// ---------------------------------------------------------------------------
const intersection: ScenarioDefinition = {
  id: "intersection",
  name: "Unsignalized Intersection",
  descriptor: "No traffic signal • Cross conflicts",
  speedLimitKmh: 35,
  road: {
    length: 1300,
    width: 8,
    laneCount: 2,
    hasLaneMarkings: true,
    shoulder: 2.4,
    intersectionAt: 220,
    curvature: 0.4,
  },
  staticObjects: (() => {
    const objs: StaticObject[] = [];
    for (let x = 20; x < 1300; x += 70) {
      if (Math.abs(x - 220) < 30) continue;
      const side = Math.random() > 0.5 ? 1 : -1;
      objs.push({ id: nextId("obj"), type: "sign", position: { x, y: side * 6 }, width: 0.6, height: 2 });
    }
    return objs;
  })(),
  initialAgents: () => {
    const list: AgentState[] = [];
    list.push(
      agent({
        id: nextId("V"),
        label: "V-01",
        type: "vehicle",
        position: { x: 300, y: 1.2 },
        heading: 0,
        speed: 9.0,
        radius: 1.1,
        behavior: "cruise",
        uncertainty: 0.12,
        hidden: false,
      }),
    );
    return list;
  },
  ambientSpawn: (simTime, rand) => {
    if (Math.floor(simTime) % 14 !== 0) return null;
    if (rand() > 0.5) return null;
    const fromTop = rand() > 0.5;
    return agent({
      id: nextId("V"),
      label: `V-X${randInt(rand, 1, 99)}`,
      type: "vehicle",
      position: { x: 220 + randRange(rand, -1, 1), y: fromTop ? -14 : 14 },
      heading: fromTop ? Math.PI / 2 : -Math.PI / 2,
      speed: 6.5,
      radius: 1.1,
      behavior: "crossing",
      uncertainty: 0.22,
      hidden: false,
      spawnTime: simTime,
      ttl: simTime + 12,
    });
  },
};

// ---------------------------------------------------------------------------
// Highway Merge
// ---------------------------------------------------------------------------
const highwayMerge: ScenarioDefinition = {
  id: "highway-merge",
  name: "Highway Merge",
  descriptor: "Structured lanes • High relative velocity",
  speedLimitKmh: 80,
  road: { length: 2000, width: 11, laneCount: 3, hasLaneMarkings: true, shoulder: 2.5, mergeAt: 260, curvature: 0 },
  staticObjects: (() => {
    const objs: StaticObject[] = [];
    for (let x = 30; x < 2000; x += 80) {
      objs.push({ id: nextId("pole"), type: "pole", position: { x, y: -8.4 }, width: 0.4, height: 2.2 });
    }
    return objs;
  })(),
  initialAgents: () => {
    const list: AgentState[] = [];
    list.push(
      agent({
        id: nextId("V"),
        label: "V-01",
        type: "vehicle",
        position: { x: 160, y: 3.6 },
        heading: 0,
        speed: 20.5,
        radius: 1.1,
        behavior: "cruise",
        uncertainty: 0.1,
        hidden: false,
      }),
    );
    list.push(
      agent({
        id: nextId("V"),
        label: "V-02",
        type: "vehicle",
        position: { x: 90, y: 0 },
        heading: 0,
        speed: 18.0,
        radius: 1.1,
        behavior: "cruise",
        uncertainty: 0.1,
        hidden: false,
      }),
    );
    return list;
  },
};

// ---------------------------------------------------------------------------
// Cattle Crossing
// ---------------------------------------------------------------------------
const cattleCrossing: ScenarioDefinition = {
  id: "cattle-crossing",
  name: "Cattle Crossing",
  descriptor: "Unstructured road • High-uncertainty agent",
  speedLimitKmh: 35,
  road: { length: 1300, width: 8.5, laneCount: 2, hasLaneMarkings: false, shoulder: 4, curvature: 3.2 },
  staticObjects: (() => {
    const objs: StaticObject[] = [];
    for (let x = 20; x < 1300; x += randInt(() => Math.random(), 60, 100)) {
      const side = Math.random() > 0.5 ? 1 : -1;
      objs.push({ id: nextId("tree"), type: "tree", position: { x, y: side * (7 + Math.random() * 2) }, width: 1.3, height: 1.3 });
    }
    return objs;
  })(),
  initialAgents: () => {
    const list: AgentState[] = [];
    list.push(
      agent({
        id: nextId("A"),
        label: "A-01",
        type: "cattle",
        position: { x: 100, y: 4.6 },
        heading: Math.PI,
        speed: 0.4,
        radius: 0.65,
        behavior: "erratic",
        uncertainty: 0.55,
        hidden: false,
      }),
    );
    return list;
  },
};

export const SCENARIOS: Record<string, ScenarioDefinition> = {
  "village-road": villageRoad,
  "dense-market": denseMarket,
  intersection: intersection,
  "highway-merge": highwayMerge,
  "cattle-crossing": cattleCrossing,
};

export const SCENARIO_ORDER = [
  "village-road",
  "dense-market",
  "intersection",
  "highway-merge",
  "cattle-crossing",
] as const;

export { nextId };
