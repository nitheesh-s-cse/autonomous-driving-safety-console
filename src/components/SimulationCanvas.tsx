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
  const drawLine = (pts: Vec2[], color: string, dashed: boolean) => {
    if (pts.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([6, 5]);
    ctx.beginPath();
    const start = toScreen(curr.ego.position.x, curr.ego.lateral);
    ctx.moveTo(start.x, start.y);
    pts.forEach((p, i) => {
      const s = toScreen(p.x, p.y);
      ctx.globalAlpha = Math.max(0.08, 0.85 - i * 0.07);
      ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.restore();
  };
  drawLine(curr.plannedPath, "#21D4FD", false);
  if (curr.replanPath) drawLine(curr.replanPath, "#3B82F6", true);
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
    } else {
      // vehicle / bike rectangle, rotated with heading already applied
      const length = a.type === "bike" ? r * 2.2 : r * 2.6;
      const width = a.type === "bike" ? r * 1.0 : r * 1.7;
      ctx.fillStyle = "#0f151b";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-length / 2, -width / 2, length, width, 3);
      ctx.fill();
      ctx.stroke();
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
  const length = 4.2 * pxPerMeter;
  const width = 1.9 * pxPerMeter;

  ctx.save();
  ctx.translate(p.x, p.y);

  // Sensor field
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#21D4FD";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, length * 3.2, -0.5, 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Body
  ctx.fillStyle = "#141c24";
  ctx.strokeStyle = "#21D4FD";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-length / 2, -width / 2, length, width, 4);
  ctx.fill();
  ctx.stroke();

  // Direction marker
  ctx.fillStyle = "#21D4FD";
  ctx.beginPath();
  ctx.moveTo(length / 2 - 3, 0);
  ctx.lineTo(length / 2 - 9, -4);
  ctx.lineTo(length / 2 - 9, 4);
  ctx.closePath();
  ctx.fill();

  // Brake lights
  if (curr.ego.braking || curr.ego.emergencyBraking) {
    ctx.fillStyle = curr.ego.emergencyBraking ? "#FF4D5E" : "#ff8a8a";
    ctx.globalAlpha = curr.ego.emergencyBraking ? 1 : 0.8;
    ctx.beginPath();
    ctx.roundRect(-length / 2, -width / 2, 3, width, 1);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Turn signal
  if (curr.ego.turnSignal !== "none") {
    const sign = curr.ego.turnSignal === "right" ? 1 : -1;
    ctx.fillStyle = "#FFB547";
    ctx.beginPath();
    ctx.arc(length / 2 - 6, sign * (width / 2 + 2), 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Label
  ctx.save();
  ctx.font = "700 10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(7,10,14,0.78)";
  const label = `EGO · ${Math.round(egoSpeed * 3.6)} km/h`;
  const tw = ctx.measureText(label).width;
  ctx.fillRect(p.x - tw / 2 - 5, p.y - width / 2 - 24, tw + 10, 15);
  ctx.fillStyle = "#21D4FD";
  ctx.fillText(label, p.x, p.y - width / 2 - 13);
  ctx.restore();
}
