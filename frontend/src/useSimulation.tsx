import { createContext, useContext } from "react";
import type {
  InventoryUpdateItem,
  LiveSimulationConfig,
  LiveSimulationState,
  OrderAdviceResponse,
} from "./api/client";

export interface SimulationContextType {
  data: OrderAdviceResponse | null;
  liveSimulation: LiveSimulationState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshLiveSimulation: () => Promise<void>;
  startLiveService: () => Promise<void>;
  stopLiveService: () => Promise<void>;
  advanceLiveService: () => Promise<void>;
  resetLiveService: () => Promise<void>;
  saveSimulationConfig: (config: Partial<LiveSimulationConfig>) => Promise<void>;
  saveInventory: (items: InventoryUpdateItem[]) => Promise<void>;
  approveOrder: (id: string) => Promise<void>;
  rejectOrder: (id: string) => Promise<void>;
}

export const SimulationContext = createContext<
  SimulationContextType | undefined
>(undefined);

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx)
    throw new Error("useSimulation must be used within SimulationProvider");
  return ctx;
}
