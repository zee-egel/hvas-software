import { createContext, useContext } from "react";
import type { OrderAdviceResponse } from "./api/client";

export interface SimulationContextType {
  data: OrderAdviceResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  approveOrder: (id: string) => Promise<void>;
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
