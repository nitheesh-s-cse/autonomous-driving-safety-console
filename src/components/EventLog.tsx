import { useEffect, useRef } from "react";
import { Panel } from "./Panel";
import type { EventCategory, SimEvent } from "../simulation/types";
import { formatEventTime } from "../utils/format";
import { cn } from "../utils/cn";

const CATEGORY_COLOR: Record<EventCategory, string> = {
  SYSTEM: "#697582",
  SCENARIO: "#3B82F6",
  PERCEPTION: "#21D4FD",
  PREDICTION: "#FFB547",
  RISK: "#FFB547",
  PLANNER: "#3B82F6",
  REFLEX: "#FF4D5E",
  CONTROL: "#FF4D5E",
};

export function EventLog({ events }: { events: SimEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const manualScroll = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || manualScroll.current) return;
    el.scrollTop = el.scrollHeight;
  }, [events]);

  return (
    <Panel title="Event Log" padded={false} className="h-full">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          manualScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight > 40;
        }}
        className="scrollbar-thin h-full max-h-[220px] min-h-[140px] overflow-y-auto px-3 py-2 font-mono"
      >
        {events.slice(-80).map((e) => (
          <div key={e.id} className="flex gap-2 py-[3px] text-[11px] leading-tight">
            <span className="tabular shrink-0 text-[#697582]">{formatEventTime(e.time)}</span>
            <span
              className={cn("w-[74px] shrink-0 truncate text-[10px] font-semibold uppercase tracking-wide")}
              style={{ color: CATEGORY_COLOR[e.category] }}
            >
              {e.category}
            </span>
            <span className="text-[#D6DCE2]">{e.message}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
