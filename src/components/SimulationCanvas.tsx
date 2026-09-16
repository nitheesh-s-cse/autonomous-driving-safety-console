import { useEffect, useRef } from "react";
import type { SimulationEngine } from "../simulation/engine";
import type { AgentState, EngineSnapshot, Vec2, VisualizationLayers } from "../simulation/types";
import { UI_PUBLISH_HZ } from "../simulation/constants";
import { levelColor } from "./ui";

const SNAPSHOT_INTERVAL_MS = 1000 / UI_PUBLISH_HZ;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

type ViewMode = "FOLLOW" | "OVERVIEW";

export function SimulationCanvas({ engine, viewMode }: { engine: SimulationEngine; viewMode: ViewMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSnap = useRef<EngineSnapshot | null>(null);
  const currSnap = useRef<EngineSnapshot | null>(null);
  const currTime = useRef(0);
  const rafRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const unsub = engine.subscribe((snap) => {
      prevSnap.current = currSnap.current ?? snap;
      currSnap.current = snap;
      currTime.current = performance.now();
    });
    return unsub;
  }, [engine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const curr = currSnap.current;
      const prev = prevSnap.current ?? curr;
      if (!curr || !prev) return;
      const alpha = curr.running
        ? Math.min(1, Math.max(0, (performance.now() - currTime.current) / SNAPSHOT_INTERVAL_MS))
        : 1;
      renderFrame(ctx, sizeRef.current.w, sizeRef.current.h, prev, curr, alpha, engine.getLayers(), viewMode);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [engine, viewMode]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-b-[12px] bg-[#070a0e]">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  prev: EngineSnapshot,
  curr: EngineSnapshot,
  alpha: number,
  layers: VisualizationLayers,
  viewMode: ViewMode,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#070a0e";
  ctx.fillRect(0, 0, w, h);

  const road = curr.road;
  const viewMeters = viewMode === "OVERVIEW" ? 150 : 68;
  const pxPerMeter = w / viewMeters;
  const followFrac = viewMode === "OVERVIEW" ? 0.5 : 0.28;

  const egoX = lerp(prev.ego.position.x, curr.ego.position.x, alpha);
  const egoLateral = lerp(prev.ego.lateral, curr.ego.lateral, alpha);
  const egoSpeed = lerp(prev.ego.speed, curr.ego.speed, alpha);
  const cameraX = egoX - viewMeters * followFrac;
  const centerY = h / 2;

  const curveAt = (x: number) => Math.sin(x * 0.018) * road.curvature;

  const toScreen = (wx: number, wy: number): Vec2 => {
    const sx = (wx - cameraX) * pxPerMeter;
    const sy = centerY + (curveAt(wx) + wy) * pxPerMeter;
    return { x: sx, y: sy };
  };

  drawGround(ctx, w, h);
  drawRoad(ctx, road, toScreen, cameraX, viewMeters, pxPerMeter);
  drawStaticObjects(ctx, curr.staticObjects, toScreen, cameraX, viewMeters);

  if (layers.riskZones) drawSafetyEnvelope(ctx, toScreen, egoX, egoLateral, curr.risk, pxPerMeter);

  if (layers.predictions) drawPredictions(ctx, curr, toScreen);
  if (layers.plannedPath) drawPlannedPath(ctx, curr, toScreen);

  drawAgents(ctx, prev, curr, alpha, toScreen, pxPerMeter, layers, egoX);

  drawEgo(ctx, toScreen, egoX, egoLateral, egoSpeed, curr, pxPerMeter);
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0b1016");
  grad.addColorStop(1, "#070a0e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawRoad(
  ctx: CanvasRenderingContext2D,
  road: EngineSnapshot["road"],
  toScreen: (x: number, y: number) => Vec2,
  cameraX: number,
  viewMeters: number,
  pxPerMeter: number,
) {
  const half = road.width / 2;
  const startX = cameraX - 10;
  const endX = cameraX + viewMeters + 10;
  const step = 4;

  // Shoulder / earth
  ctx.fillStyle = "#0e1319";
  ctx.fillRect(-2000, -2000, 8000, 8000);

  // Road surface as a series of quads following curvature.
  ctx.beginPath();
  for (let x = startX; x <= endX; x += step) {
    const p = toScreen(x, -half);
    if (x === startX) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  for (let x = endX; x >= startX; x -= step) {
    const p = toScreen(x, half);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = "#151b22";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Lane markings
  if (road.hasLaneMarkings && road.laneCount > 1) {
    const laneW = road.width / road.laneCount;
    for (let i = 1; i < road.laneCount; i++) {
      const y = -half + i * laneW;
      ctx.beginPath();
      ctx.setLineDash([pxPerMeter * 1.4, pxPerMeter * 1.4]);
      for (let x = startX; x <= endX; x += step) {
        const p = toScreen(x, y);
        if (x === startX) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else {
    // Unstructured faint centerline
    ctx.beginPath();
    ctx.setLineDash([pxPerMeter * 0.8, pxPerMeter * 1.6]);
    for (let x = startX; x <= endX; x += step) {
      const p = toScreen(x, 0);
      if (x === startX) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Intersection cross-road
  if (road.intersectionAt !== undefined) {
    const cx = road.intersectionAt;
    if (cx > cameraX - 20 && cx < cameraX + viewMeters + 20) {
      const top = toScreen(cx - half, -16);
      const bot = toScreen(cx + half, 16);
      ctx.fillStyle = "#151b22";
      ctx.fillRect(top.x, -2000, bot.x - top.x, 4000);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.strokeRect(top.x, -2000, bot.x - top.x, 4000);
    }
  }

  // Edge lines
  ctx.beginPath();
  for (let x = startX; x <= endX; x += step) {
    const p = toScreen(x, -half);
    if (x === startX) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  for (let x = startX; x <= endX; x += step) {
    const p = toScreen(x, half);
    if (x === startX) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

function drawStaticObjects(
  ctx: CanvasRenderingContext2D,
  objects: EngineSnapshot["staticObjects"],
  toScreen: (x: number, y: number) => Vec2,
  cameraX: number,
  viewMeters: number,
) {
  for (const o of objects) {
    if (o.position.x < cameraX - 15 || o.position.x > cameraX + viewMeters + 15) continue;
    const p = toScreen(o.position.x, o.position.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (o.type === "tree") {
      ctx.fillStyle = "#1c2b22";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a4534";
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.type === "pole" || o.type === "sign") {
      ctx.fillStyle = "#30383f";
      ctx.fillRect(-1.2, -10, 2.4, 10);
      ctx.fillStyle = "#3d4750";
      ctx.fillRect(-3, -14, 6, 4);
    } else if (o.type === "stall" || o.type === "building") {
      ctx.fillStyle = "#1a2129";
      ctx.fillRect(-14, -10, 28, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(-14, -10, 28, 14);
      ctx.fillStyle = "#252f39";
      ctx.fillRect(-14, -14, 28, 5);
    } else if (o.type === "parkedVehicle") {
      ctx.fillStyle = "#232b33";
      ctx.fillRect(-9, -5, 18, 10);
    }
    ctx.restore();
  }
}

function riskGlowColor(level: EngineSnapshot["risk"]["level"]) {
  return levelColor(level);
}

function drawSafetyEnvelope(
  ctx: CanvasRenderingContext2D,
  toScreen: (x: number, y: number) => Vec2,
  egoX: number,
  egoLateral: number,
  risk: EngineSnapshot["risk"],
  pxPerMeter: number,
) {
  const color = riskGlowColor(risk.level);
  const center = toScreen(egoX, egoLateral);
  const forward = Math.max(6, Math.min(45, risk.stoppingDistance));
  const front = toScreen(egoX + forward, egoLateral);
  const radiusX = (front.x - center.x);
  const radiusY = 3.4 * pxPerMeter;

  ctx.save();
  ctx.globalAlpha = risk.level === "SAFE" ? 0.12 : risk.level === "CAUTION" ? 0.16 : 0.22;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(center.x + radiusX * 0.35, center.y, Math.abs(radiusX) * 0.62, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha *= 0.5;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawPredictions(ctx: CanvasRenderingContext2D, curr: EngineSnapshot, toScreen: (x: number, y: number) => Vec2) {
  for (const pred of curr.predictions) {
    const isCritical = pred.agentId === curr.risk.nearestAgentId && curr.risk.level === "INTERVENE";
    const color = isCritical ? "#FF4D5E" : "#FFB547";
    ctx.save();
    ctx.strokeStyle = color;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    pred.points.forEach((p, i) => {
      const s = toScreen(p.x, p.y);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    const totalAlpha = 0.75;
    ctx.globalAlpha = totalAlpha;
    ctx.stroke();
    ctx.setLineDash([]);

    // Uncertainty cone (fading fill)
    pred.points.forEach((p, i) => {
      const s = toScreen(p.x, p.y);
      const r = Math.max(2, pred.uncertainty[i] * 10);
      ctx.globalAlpha = Math.max(0.02, 0.16 - i * 0.013);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}

function drawPlannedPath(ctx: CanvasRenderingContext2D, curr: EngineSnapshot, toScreen: (x: number, y: number) => Vec2) {
  const isOvertake = curr.planner.mode === "REPLAN" && Boolean(curr.replanPath);
  const activePath = isOvertake && curr.replanPath ? curr.replanPath : curr.plannedPath;

  // 1. Draw autonomous vehicle safety corridor ribbon (navigable envelope ±0.85m)
  if (activePath.length > 1) {
    ctx.save();
    ctx.fillStyle = isOvertake ? "rgba(33, 212, 253, 0.09)" : "rgba(33, 212, 253, 0.05)";
    ctx.beginPath();
    const startLeft = toScreen(curr.ego.position.x, curr.ego.lateral - 0.85);
    ctx.moveTo(startLeft.x, startLeft.y);
    activePath.forEach((p) => {
      const s = toScreen(p.x, p.y - 0.85);
      ctx.lineTo(s.x, s.y);
    });
    for (let i = activePath.length - 1; i >= 0; i--) {
      const p = activePath[i];
      const s = toScreen(p.x, p.y + 0.85);
      ctx.lineTo(s.x, s.y);
    }
    const startRight = toScreen(curr.ego.position.x, curr.ego.lateral + 0.85);
    ctx.lineTo(startRight.x, startRight.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 2. Trajectory line renderer with glowing beads and gradient line
  const drawLine = (pts: Vec2[], color: string, dashed: boolean, isMain: boolean) => {
    if (pts.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = isMain ? 2.4 : 1.6;
    if (isMain) {
      ctx.shadowColor = color;
      ctx.shadowBlur = isOvertake ? 9 : 6;
    }
    if (dashed) ctx.setLineDash([5, 5]);
    ctx.beginPath();
    const start = toScreen(curr.ego.position.x, curr.ego.lateral);
    ctx.moveTo(start.x, start.y);
    pts.forEach((p, i) => {
      const s = toScreen(p.x, p.y);
      ctx.globalAlpha = Math.max(0.1, 0.92 - i * 0.06);
      ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();

    // Trajectory waypoint nodes
    if (isMain) {
      ctx.setLineDash([]);
      pts.forEach((p, i) => {
        const s = toScreen(p.x, p.y);
        ctx.globalAlpha = Math.max(0.2, 0.95 - i * 0.08);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, i === 0 ? 3.0 : 2.0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  };

  if (isOvertake && curr.replanPath) {
    // Background: original centerline in subtle dashed gray
    drawLine(curr.plannedPath, "rgba(255, 255, 255, 0.22)", true, false);
    // Foreground: glowing cyber cyan overtake trajectory
    drawLine(curr.replanPath, "#21D4FD", false, true);
  } else {
    drawLine(curr.plannedPath, "#21D4FD", false, true);
  }
}

function agentColor(a: AgentState): string {
  switch (a.type) {
    case "pedestrian":
      return "#F4F7FA";
    case "bike":
      return "#FFB547";
    case "vehicle":
      return "#8FB4FF";
    case "cattle":
      return "#C9A46A";
    case "obstacle":
      return "#FF4D5E";
  }
}

function drawAgents(
  ctx: CanvasRenderingContext2D,
  prev: EngineSnapshot,
  curr: EngineSnapshot,
  alpha: number,
  toScreen: (x: number, y: number) => Vec2,
  pxPerMeter: number,
  layers: VisualizationLayers,
  egoX: number,
) {
  const prevMap = new Map(prev.agents.map((a) => [a.id, a]));
  for (const a of curr.agents) {
    const dx = a.position.x - egoX;
    if (dx < -18 || dx > 62) continue;
    const p0 = prevMap.get(a.id);
    const pos = p0 ? lerpVec(p0.position, a.position, alpha) : a.position;
    const s = toScreen(pos.x, pos.y);

    if (a.hidden) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#697582";
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, a.radius * pxPerMeter + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#9aa5b1";
      ctx.font = "600 9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("OCCLUDED", s.x, s.y - a.radius * pxPerMeter - 8);
      ctx.restore();
      continue;
    }

    const color = agentColor(a);
    const r = a.radius * pxPerMeter;
    const isFocus = a.id === curr.risk.nearestAgentId;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(a.heading);

    if (a.type === "pedestrian" || a.type === "cattle") {
      ctx.rotate(-a.heading);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (a.type === "cattle") {
        ctx.fillStyle = "#8a6a3f";
        ctx.beginPath();
        ctx.ellipse(-r * 0.6, 0, r * 0.7, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (a.type === "obstacle") {
      ctx.rotate(-a.heading);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
    } else if (a.type === "bike") {
      drawRealisticBike(ctx, r * 2.5, r * 1.2, color);
    } else {
      // vehicle agent: realistic top-down car
      const length = r * 2.8;
      const width = r * 1.45;
      const isCutIn = a.behavior === "cutIn";
      drawRealisticCar({
        ctx,
        length,
        width,
        color,
        isEgo: false,
        braking: false,
        turnSignal: isCutIn ? (a.position.y > 0 ? "left" : "right") : "none",
        steeringAngle: isCutIn ? (a.position.y > 0 ? -0.12 : 0.12) : 0,
      });
    }
    ctx.restore();

    if (layers.detections && !isFocus) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "rgba(33,212,253,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (isFocus) {
      ctx.save();
      ctx.strokeStyle = levelColor(curr.risk.level);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (layers.objectLabels && (isFocus || a.hazardTag || a.behavior === "crossing" || a.behavior === "erratic" || a.behavior === "cutIn")) {
      ctx.save();
      ctx.fillStyle = "rgba(7,10,14,0.72)";
      const label = `${a.label}`;
      ctx.font = "600 10px Inter, sans-serif";
      const tw = ctx.measureText(label).width;
      ctx.fillRect(s.x - tw / 2 - 4, s.y - r - 22, tw + 8, 14);
      ctx.fillStyle = "#F4F7FA";
      ctx.textAlign = "center";
      ctx.fillText(label, s.x, s.y - r - 12);
      ctx.restore();
    }
  }
}

interface RealisticCarProps {
  ctx: CanvasRenderingContext2D;
  length: number;
  width: number;
  color: string;
  isEgo: boolean;
  braking?: boolean;
  emergencyBraking?: boolean;
  turnSignal?: "left" | "right" | "none";
  steeringAngle?: number;
  speed?: number;
}

function drawRealisticCar({
  ctx,
  length,
  width,
  color,
  isEgo,
  braking,
  emergencyBraking,
  turnSignal = "none",
  steeringAngle = 0,
}: RealisticCarProps) {
  const isBrakingActive = Boolean(braking || emergencyBraking);
  const blinkOn = Math.floor(performance.now() / 260) % 2 === 0;

  // 1. Headlight Projector Cones (Volumetric forward light throw on the road)
  const beamLength = Math.max(30, length * 2.1);
  const beamSpread = width * 0.44;
  const drawLightBeam = (sourceY: number) => {
    ctx.save();
    const grad = ctx.createLinearGradient(length * 0.44, sourceY, length * 0.44 + beamLength, sourceY);
    grad.addColorStop(0, isEgo ? "rgba(33, 212, 253, 0.28)" : "rgba(255, 250, 220, 0.20)");
    grad.addColorStop(0.35, isEgo ? "rgba(33, 212, 253, 0.09)" : "rgba(255, 250, 220, 0.07)");
    grad.addColorStop(1, "rgba(33, 212, 253, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(length * 0.44, sourceY);
    ctx.lineTo(length * 0.44 + beamLength, sourceY - beamSpread);
    ctx.lineTo(length * 0.44 + beamLength, sourceY + beamSpread);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  drawLightBeam(-width * 0.28);
  drawLightBeam(width * 0.28);

  // 2. Ambient Occlusion / Drop Shadow under the car body
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
  ctx.beginPath();
  ctx.roundRect(-length * 0.48, -width * 0.48, length * 0.96, width * 0.96, width * 0.22);
  ctx.fill();
  ctx.restore();

  // 3. Wheels / Tires (4 tires with rubber tread and alloy rim)
  const tireLength = length * 0.22;
  const tireWidth = width * 0.16;
  const wheelBase = length * 0.27;
  const track = width * 0.45;

  const drawTire = (x: number, y: number, steer: number = 0) => {
    ctx.save();
    ctx.translate(x, y);
    if (steer !== 0) ctx.rotate(steer);
    // Rubber tire
    ctx.fillStyle = "#0c1015";
    ctx.strokeStyle = "#25303d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-tireLength / 2, -tireWidth / 2, tireLength, tireWidth, 2.5);
    ctx.fill();
    ctx.stroke();
    // Alloy rim accent
    ctx.strokeStyle = isEgo ? "rgba(33, 212, 253, 0.5)" : "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-tireLength * 0.24, 0);
    ctx.lineTo(tireLength * 0.24, 0);
    ctx.stroke();
    ctx.restore();
  };

  // Front tires with dynamic steering angle
  drawTire(wheelBase, -track, steeringAngle);
  drawTire(wheelBase, track, steeringAngle);
  // Rear fixed tires
  drawTire(-wheelBase, -track, 0);
  drawTire(-wheelBase, track, 0);

  // 4. Aerodynamic Sculpted Chassis / Body
  ctx.save();
  ctx.beginPath();
  // Nose front center
  ctx.moveTo(length * 0.49, 0);
  // Front left bumper
  ctx.bezierCurveTo(length * 0.49, -width * 0.24, length * 0.46, -width * 0.40, length * 0.36, -width * 0.45);
  // Front left wheel arch
  ctx.bezierCurveTo(length * 0.28, -width * 0.49, length * 0.22, -width * 0.49, length * 0.15, -width * 0.44);
  // Cabin left waist
  ctx.bezierCurveTo(length * 0.05, -width * 0.41, -length * 0.05, -width * 0.41, -length * 0.15, -width * 0.44);
  // Rear left wheel arch
  ctx.bezierCurveTo(-length * 0.22, -width * 0.49, -length * 0.28, -width * 0.49, -length * 0.36, -width * 0.45);
  // Rear left bumper corner
  ctx.bezierCurveTo(-length * 0.45, -width * 0.40, -length * 0.49, -width * 0.24, -length * 0.49, 0);
  // Rear right bumper corner
  ctx.bezierCurveTo(-length * 0.49, width * 0.24, -length * 0.45, width * 0.40, -length * 0.36, width * 0.45);
  // Rear right wheel arch
  ctx.bezierCurveTo(-length * 0.28, width * 0.49, -length * 0.22, width * 0.49, -length * 0.15, width * 0.44);
  // Cabin right waist
  ctx.bezierCurveTo(-length * 0.05, width * 0.41, length * 0.05, width * 0.41, length * 0.15, width * 0.44);
  // Front right wheel arch
  ctx.bezierCurveTo(length * 0.22, width * 0.49, length * 0.28, width * 0.49, length * 0.36, width * 0.45);
  // Front right bumper
  ctx.bezierCurveTo(length * 0.46, width * 0.40, length * 0.49, width * 0.24, length * 0.49, 0);
  ctx.closePath();

  // Metallic body paint gradient
  const bodyGrad = ctx.createLinearGradient(-length * 0.5, 0, length * 0.5, 0);
  if (isEgo) {
    bodyGrad.addColorStop(0, "#0c131a");
    bodyGrad.addColorStop(0.35, "#14202c");
    bodyGrad.addColorStop(0.7, "#192938");
    bodyGrad.addColorStop(1, "#121d28");
  } else {
    bodyGrad.addColorStop(0, "#0f1620");
    bodyGrad.addColorStop(0.4, "#192432");
    bodyGrad.addColorStop(1, "#121a24");
  }
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Sleek cyber perimeter edge stroke
  ctx.strokeStyle = isEgo ? "#21D4FD" : color;
  ctx.lineWidth = isEgo ? 1.7 : 1.3;
  ctx.stroke();
  ctx.restore();

  // 5. Hood Power-Creases
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(length * 0.15, -width * 0.27);
  ctx.lineTo(length * 0.41, -width * 0.14);
  ctx.moveTo(length * 0.15, width * 0.27);
  ctx.lineTo(length * 0.41, width * 0.14);
  ctx.stroke();
  ctx.restore();

  // 6. Aerodynamic Side Wing Mirrors
  const mirrorX = length * 0.14;
  const mirrorY = width * 0.52;
  const mirrorW = length * 0.08;
  const mirrorH = width * 0.13;
  ctx.save();
  ctx.fillStyle = "#101822";
  ctx.strokeStyle = isEgo ? "#21D4FD" : color;
  ctx.lineWidth = 1;
  // Left mirror
  ctx.beginPath();
  ctx.roundRect(mirrorX - mirrorW / 2, -mirrorY - mirrorH / 2, mirrorW, mirrorH, 2);
  ctx.fill();
  ctx.stroke();
  // Right mirror
  ctx.beginPath();
  ctx.roundRect(mirrorX - mirrorW / 2, mirrorY - mirrorH / 2, mirrorW, mirrorH, 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 7. Glasshouse / Cabin: Windshield, Panoramic Roof, Rear Window
  ctx.save();
  // Front Windshield
  ctx.beginPath();
  ctx.moveTo(length * 0.21, -width * 0.32);
  ctx.quadraticCurveTo(length * 0.23, 0, length * 0.21, width * 0.32);
  ctx.lineTo(length * 0.08, width * 0.36);
  ctx.quadraticCurveTo(length * 0.09, 0, length * 0.08, -width * 0.36);
  ctx.closePath();
  const wsGrad = ctx.createLinearGradient(length * 0.08, 0, length * 0.22, 0);
  wsGrad.addColorStop(0, "#080e14");
  wsGrad.addColorStop(1, isEgo ? "#13283a" : "#111c26");
  ctx.fillStyle = wsGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // Windshield light reflection slash
  ctx.beginPath();
  ctx.moveTo(length * 0.17, -width * 0.20);
  ctx.lineTo(length * 0.10, width * 0.16);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Panoramic Glass Roof
  ctx.fillStyle = isEgo ? "#09121a" : "#0a0f14";
  ctx.beginPath();
  ctx.roundRect(-length * 0.16, -width * 0.34, length * 0.24, width * 0.68, 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Rear Windshield
  ctx.beginPath();
  ctx.moveTo(-length * 0.16, -width * 0.34);
  ctx.lineTo(-length * 0.16, width * 0.34);
  ctx.lineTo(-length * 0.29, width * 0.27);
  ctx.quadraticCurveTo(-length * 0.30, 0, -length * 0.29, -width * 0.27);
  ctx.closePath();
  ctx.fillStyle = "#070c10";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();

  // 8. Roof-Mounted LiDAR / Autonomous Sensor Turret (for Ego vehicle)
  if (isEgo) {
    const puckX = length * 0.02;
    const puckR = Math.max(3.2, width * 0.15);
    ctx.save();
    // Base housing
    ctx.fillStyle = "#091017";
    ctx.strokeStyle = "#21D4FD";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(puckX, 0, puckR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotating LiDAR laser radar sweep
    const sweepAngle = (performance.now() * 0.005) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(puckX, 0);
    ctx.arc(puckX, 0, puckR * 0.85, sweepAngle - 0.8, sweepAngle);
    ctx.closePath();
    ctx.fillStyle = "rgba(33, 212, 253, 0.55)";
    ctx.fill();

    // Core optics lens
    ctx.fillStyle = "#E0F7FF";
    ctx.beginPath();
    ctx.arc(puckX, 0, puckR * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 9. LED Headlights & Daytime Running Lights (DRLs)
  const hlX = length * 0.44;
  const hlY = width * 0.34;
  const drawHeadlight = (sign: number) => {
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = isEgo ? "#21D4FD" : "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hlX, sign * hlY);
    ctx.lineTo(length * 0.48, sign * (hlY - width * 0.09));
    ctx.lineTo(length * 0.46, sign * (hlY - width * 0.15));
    ctx.lineTo(hlX - length * 0.03, sign * (hlY - width * 0.05));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  drawHeadlight(-1);
  drawHeadlight(1);

  // 10. Rear Taillights & Dynamic Brake Lights
  const tailX = -length * 0.48;
  const tailY = width * 0.34;

  // Rear brake road illumination halo
  if (isBrakingActive) {
    ctx.save();
    const brakeHalo = ctx.createRadialGradient(tailX, 0, 1, tailX - length * 0.4, 0, length * 0.7);
    brakeHalo.addColorStop(0, emergencyBraking ? "rgba(255, 30, 56, 0.55)" : "rgba(255, 45, 65, 0.38)");
    brakeHalo.addColorStop(1, "rgba(255, 0, 0, 0)");
    ctx.fillStyle = brakeHalo;
    ctx.beginPath();
    ctx.arc(tailX, 0, length * 0.7, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    ctx.restore();
  }

  // Taillight bar
  ctx.save();
  const tailColor = isBrakingActive
    ? (emergencyBraking ? "#FF1E38" : "#FF334B")
    : "#c81e30";
  ctx.strokeStyle = tailColor;
  ctx.lineWidth = isBrakingActive ? 2.5 : 1.8;
  ctx.shadowColor = tailColor;
  ctx.shadowBlur = isBrakingActive ? 8 : 2;
  ctx.beginPath();
  ctx.moveTo(tailX + length * 0.03, -tailY);
  ctx.lineTo(tailX, -tailY * 0.6);
  ctx.lineTo(tailX, tailY * 0.6);
  ctx.lineTo(tailX + length * 0.03, tailY);
  ctx.stroke();
  ctx.restore();

  // 11. Dynamic Turn Signals
  if (turnSignal !== "none" && blinkOn) {
    const sign = turnSignal === "right" ? 1 : -1;
    ctx.save();
    ctx.fillStyle = "#FFB547";
    ctx.shadowColor = "#FFB547";
    ctx.shadowBlur = 6;
    // Front corner blinker
    ctx.beginPath();
    ctx.arc(length * 0.44, sign * (width * 0.38), 2.4, 0, Math.PI * 2);
    ctx.fill();
    // Mirror blinker
    ctx.beginPath();
    ctx.arc(mirrorX, sign * (mirrorY + 2), 2, 0, Math.PI * 2);
    ctx.fill();
    // Rear corner blinker
    ctx.beginPath();
    ctx.arc(tailX + 2, sign * (tailY - 2), 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRealisticBike(
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  color: string,
) {
  ctx.save();
  // Ground shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 0, length * 0.48, width * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  // Front wheel tire
  ctx.fillStyle = "#0c1015";
  ctx.strokeStyle = "#2e3b48";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(length * 0.28, -width * 0.12, length * 0.22, width * 0.24, 2);
  ctx.fill();
  ctx.stroke();

  // Rear wheel tire
  ctx.beginPath();
  ctx.roundRect(-length * 0.44, -width * 0.12, length * 0.22, width * 0.24, 2);
  ctx.fill();
  ctx.stroke();

  // Bike Frame / Backbone
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-length * 0.32, 0);
  ctx.lineTo(0, 0);
  ctx.lineTo(length * 0.28, 0);
  ctx.stroke();

  // Handlebars
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(length * 0.20, -width * 0.44);
  ctx.lineTo(length * 0.20, width * 0.44);
  ctx.stroke();
  // Handlebar grips
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(length * 0.17, -width * 0.47, length * 0.06, width * 0.12);
  ctx.fillRect(length * 0.17, width * 0.35, length * 0.06, width * 0.12);

  // Rider torso & shoulders
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.ellipse(-length * 0.06, 0, length * 0.18, width * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rider Helmet
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-length * 0.04, 0, width * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // Helmet visor
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(-length * 0.01, 0, width * 0.16, -0.6, 0.6);
  ctx.lineTo(-length * 0.01, 0);
  ctx.closePath();
  ctx.fill();

  // Front headlight
  ctx.fillStyle = "#FDE047";
  ctx.beginPath();
  ctx.arc(length * 0.40, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  // Rear taillight
  ctx.fillStyle = "#EF4444";
  ctx.beginPath();
  ctx.arc(-length * 0.46, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEgo(
  ctx: CanvasRenderingContext2D,
  toScreen: (x: number, y: number) => Vec2,
  egoX: number,
  egoLateral: number,
  egoSpeed: number,
  curr: EngineSnapshot,
  pxPerMeter: number,
) {
  const p = toScreen(egoX, egoLateral);
  const length = 4.4 * pxPerMeter;
  const width = 2.0 * pxPerMeter;

  // Road curvature alignment so the car naturally follows bends in the road
  const pAhead = toScreen(egoX + 0.6, egoLateral);
  const roadAngle = Math.atan2(pAhead.y - p.y, pAhead.x - p.x);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(roadAngle);

  // Sensor field cone (starts gracefully from the front sensor position)
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#21D4FD";
  ctx.beginPath();
  ctx.moveTo(length * 0.25, 0);
  ctx.arc(length * 0.25, 0, length * 3.4, -0.48, 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Steering angle based on lane changes / turn signal
  const lateralDiff = curr.ego.targetLateral - curr.ego.lateral;
  const steerAngle =
    curr.ego.turnSignal === "left"
      ? -0.15
      : curr.ego.turnSignal === "right"
      ? 0.15
      : Math.max(-0.15, Math.min(0.15, lateralDiff * 0.25));

  // Render high-fidelity autonomous vehicle
  drawRealisticCar({
    ctx,
    length,
    width,
    color: "#21D4FD",
    isEgo: true,
    braking: curr.ego.braking,
    emergencyBraking: curr.ego.emergencyBraking,
    turnSignal: curr.ego.turnSignal,
    steeringAngle: steerAngle,
    speed: egoSpeed,
  });

  ctx.restore();

  // Floating HUD Badge with speed and status
  ctx.save();
  ctx.font = "700 10px Inter, sans-serif";
  ctx.textAlign = "center";
  const speedKmh = Math.round(egoSpeed * 3.6);
  const label = `EGO · ${speedKmh} km/h`;
  const tw = ctx.measureText(label).width;
  const badgeY = p.y - width / 2 - 20;

  // Glass pill backdrop
  ctx.fillStyle = "rgba(7, 10, 14, 0.88)";
  ctx.strokeStyle = "rgba(33, 212, 253, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(p.x - tw / 2 - 12, badgeY - 11, tw + 24, 18, 9);
  ctx.fill();
  ctx.stroke();

  // Glowing status dot
  const dotColor = curr.ego.emergencyBraking ? "#FF4D5E" : curr.ego.braking ? "#FFB547" : "#21D4FD";
  ctx.fillStyle = dotColor;
  ctx.shadowColor = dotColor;
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(p.x - tw / 2 - 3, badgeY - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#F4F7FA";
  ctx.fillText(label, p.x + 4, badgeY + 1.5);
  ctx.restore();
}
