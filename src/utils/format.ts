export function formatSimClock(t: number): string {
  const totalMs = Math.max(0, Math.floor(t * 1000));
  const ms = totalMs % 1000;
  const totalS = Math.floor(totalMs / 1000);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60) % 60;
  const h = Math.floor(totalS / 3600);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

export function formatEventTime(t: number): string {
  const totalMs = Math.max(0, Math.floor(t * 1000));
  const ms = totalMs % 1000;
  const totalS = Math.floor(totalMs / 1000);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

export function msToKmh(v: number): number {
  return v * 3.6;
}

export function fmt1(v: number): string {
  if (!Number.isFinite(v)) return "∞";
  return v.toFixed(1);
}

export function fmt0(v: number): string {
  if (!Number.isFinite(v)) return "∞";
  return Math.round(v).toString();
}
