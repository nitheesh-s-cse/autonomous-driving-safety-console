import type { AgentState, EgoState, HazardType, RoadDefinition } from "./types";
import { nextId } from "./scenarios";
import { randInt } from "./seededRandom";

export interface HazardMeta {
  label: string;
  description: string;
  underDevelopment?: boolean;
}

export const HAZARD_META: Record<HazardType, HazardMeta> = {
  "pedestrian-crossing": {
    label: "Pedestrian Crossing",
    description: "Pedestrian enters road ahead",
    underDevelopment: false,
  },
  "twowheeler-cutin": {
    label: "Two-Wheeler Cut-In",
    description: "Bike merges into lane",
    underDevelopment: false,
  },
  "sudden-obstacle": {
    label: "Sudden Obstacle",
    description: "Static obstacle in lane",
    underDevelopment: true,
  },
  "wrongside-vehicle": {
    label: "Wrong-Side Vehicle",
    description: "Oncoming vehicle in lane",
    underDevelopment: true,
  },
  "cattle-crossing": {
    label: "Cattle Crossing",
    description: "Animal wanders toward road",
    underDevelopment: true,
  },
  "hidden-pedestrian": {
    label: "Hidden Pedestrian",
    description: "Pedestrian occluded until close range",
    underDevelopment: true,
  },
};

export const ACTIVE_HAZARDS: HazardType[] = [
  "pedestrian-crossing",
  "twowheeler-cutin",
];

export const DEV_HAZARDS: HazardType[] = [
  "sudden-obstacle",
  "wrongside-vehicle",
  "cattle-crossing",
  "hidden-pedestrian",
];

export function createHazardAgent(
  type: HazardType,
  ego: EgoState,
  road: RoadDefinition,
  rand: () => number,
  simTime: number,
): AgentState {
  const ahead = 42;
  const half = road.width / 2;

  switch (type) {
    case "pedestrian-crossing": {
      const fromTop = rand() > 0.5;
      const startY = fromTop ? -half - 1 : half + 1;
      return {
        id: nextId("P"),
        label: `P-0${randInt(rand, 4, 9)}`,
        type: "pedestrian",
        position: { x: ego.position.x + ahead, y: startY },
        heading: fromTop ? Math.PI / 2 : -Math.PI / 2,
        speed: 1.35,
        radius: 0.35,
        behavior: "crossing",
        uncertainty: 0.4,
        hidden: false,
        path: [
          { x: ego.position.x + ahead, y: -startY },
        ],
        pathIndex: 0,
        spawnTime: simTime,
        hazardTag: type,
      };
    }
    case "hidden-pedestrian": {
      const fromTop = rand() > 0.5;
      const startY = fromTop ? -half - 0.8 : half + 0.8;
      return {
        id: nextId("P"),
        label: `P-0${randInt(rand, 4, 9)}`,
        type: "pedestrian",
        position: { x: ego.position.x + ahead - 4, y: startY },
        heading: fromTop ? Math.PI / 2 : -Math.PI / 2,
        speed: 1.2,
        radius: 0.35,
        behavior: "crossing",
        uncertainty: 0.55,
        hidden: true,
        revealDistance: 22,
        path: [{ x: ego.position.x + ahead - 4, y: -startY }],
        pathIndex: 0,
        spawnTime: simTime,
        hazardTag: type,
      };
    }
    case "twowheeler-cutin": {
      const side = rand() > 0.5 ? 1 : -1;
      return {
        id: nextId("B"),
        label: `B-0${randInt(rand, 2, 9)}`,
        type: "bike",
        position: { x: ego.position.x + 8.5, y: side * (half - 0.7) },
        heading: -side * 0.24,
        speed: Math.max(7.2, ego.speed * 0.82),
        radius: 0.7,
        behavior: "cutIn",
        uncertainty: 0.28,
        hidden: false,
        path: [{ x: ego.position.x + 14, y: 0 }],
        pathIndex: 0,
        spawnTime: simTime,
        hazardTag: type,
      };
    }
    case "sudden-obstacle": {
      return {
        id: nextId("O"),
        label: `OBS-${randInt(rand, 1, 9)}`,
        type: "obstacle",
        position: { x: ego.position.x + ahead, y: 0 },
        heading: 0,
        speed: 0,
        radius: 0.9,
        behavior: "static",
        uncertainty: 0.05,
        hidden: false,
        spawnTime: simTime,
        hazardTag: type,
      };
    }
    case "wrongside-vehicle": {
      return {
        id: nextId("V"),
        label: `V-X${randInt(rand, 1, 9)}`,
        type: "vehicle",
        position: { x: ego.position.x + 60, y: 0 },
        heading: Math.PI,
        speed: 9.5,
        radius: 1.1,
        behavior: "cruise",
        uncertainty: 0.15,
        hidden: false,
        spawnTime: simTime,
        hazardTag: type,
      };
    }
    case "cattle-crossing": {
      const side = rand() > 0.5 ? 1 : -1;
      const startY = side * (half + 0.4);
      const targetY = -side * (half + 1.6);
      return {
        id: nextId("A"),
        label: `A-0${randInt(rand, 2, 9)}`,
        type: "cattle",
        position: { x: ego.position.x + 35, y: startY },
        heading: -side * Math.PI / 2,
        speed: 0.85,
        radius: 0.75,
        behavior: "erratic",
        uncertainty: 0.5,
        hidden: false,
        path: [{ x: ego.position.x + 39, y: targetY }],
        pathIndex: 0,
        spawnTime: simTime,
        hazardTag: type,
      };
    }
  }
}
