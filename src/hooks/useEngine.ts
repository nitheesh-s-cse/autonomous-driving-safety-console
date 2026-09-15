import { useEffect, useRef, useState } from "react";
import { SimulationEngine } from "../simulation/engine";
import type { EngineSnapshot } from "../simulation/types";

export function useEngine() {
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SimulationEngine("village-road", "ALIENX");
  }
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(() => engineRef.current!.getSnapshot());

  useEffect(() => {
    const engine = engineRef.current!;
    const unsubscribe = engine.subscribe(setSnapshot);
    return unsubscribe;
  }, []);

  return { engine: engineRef.current, snapshot };
}
