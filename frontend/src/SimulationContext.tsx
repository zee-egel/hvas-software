import { useCallback, useEffect, useState } from "react";
import {
  approvePurchaseOrder,
  fetchOrderAdvice,
  type OrderAdviceResponse,
} from "./api/client";

import React from "react";
import { SimulationContext } from "./useSimulation";

export function SimulationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setData] = useState<OrderAdviceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setData(await fetchOrderAdvice());
    } catch (err) {
      console.error("Failed to fetch order advice", err);
      setData(null);
      setError("Could not load smart order advice.");
    } finally {
      setLoading(false);
    }
  }, []);

  // do we need this? it will be called on app load, but do we want to call it again if the provider re-renders for some reason?
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const approveOrder = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setError(null);
      const response = await approvePurchaseOrder(id);
      setData(response.snapshot);
    } catch (err) {
      console.error("Failed to approve purchase order", err);
      setError("Could not approve the prepared order.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <SimulationContext.Provider
      value={{
        data,
        loading,
        error,
        refresh,
        approveOrder,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}
