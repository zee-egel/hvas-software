import { useCallback, useEffect, useState } from "react";
import {
  approvePurchaseOrder,
  fetchLiveSimulation,
  fetchOrderAdvice,
  type InventoryUpdateItem,
  type LiveSimulationConfig,
  type LiveSimulationState,
  type OrderAdviceResponse,
  rejectPurchaseOrder,
  resetLiveSimulation,
  startLiveSimulation,
  stopLiveSimulation,
  tickLiveSimulation,
  updateLiveSimulationConfig,
  updateInventory,
} from "./api/client";

import React from "react";
import { SimulationContext } from "./useSimulation";

export function SimulationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setData] = useState<OrderAdviceResponse | null>(null);
  const [liveSimulation, setLiveSimulation] =
    useState<LiveSimulationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [nextData, nextLiveSimulation] = await Promise.allSettled([
        fetchOrderAdvice(),
        fetchLiveSimulation(),
      ]);

      let nextError: string | null = null;

      if (nextData.status === "fulfilled") {
        setData(nextData.value);
      } else {
        console.error("Failed to fetch order advice", nextData.reason);
        nextError = "Could not load smart order advice.";
        setData(null);
      }

      if (nextLiveSimulation.status === "fulfilled") {
        setLiveSimulation(nextLiveSimulation.value);
      } else {
        console.error("Failed to fetch live simulation", nextLiveSimulation.reason);
        nextError = nextError
          ? `${nextError} Live simulation is also unavailable.`
          : "Could not load live simulation.";
        setLiveSimulation(null);
      }

      setError(nextError);
    } catch (err) {
      console.error("Failed to refresh app data", err);
      setError("Could not load app data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // do we need this? it will be called on app load, but do we want to call it again if the provider re-renders for some reason?
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshLiveSimulation = useCallback(async () => {
    try {
      setError(null);
      setLiveSimulation(await fetchLiveSimulation());
    } catch (err) {
      console.error("Failed to fetch live simulation", err);
      setError("Could not load live simulation.");
    }
  }, []);

  const saveInventory = useCallback(async (items: InventoryUpdateItem[]) => {
    setLoading(true);
    try {
      setError(null);
      const response = await updateInventory(items);
      setData(response.orderAdvice);
    } catch (err) {
      console.error("Failed to update inventory", err);
      setError("Could not save inventory changes.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const rejectOrder = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setError(null);
      const response = await rejectPurchaseOrder(id);
      setData(response.snapshot);
    } catch (err) {
      console.error("Failed to reject purchase order", err);
      setError("Could not reject the prepared order.");
    } finally {
      setLoading(false);
    }
  }, []);

  const startLiveService = useCallback(async () => {
    try {
      setError(null);
      setLiveSimulation(await startLiveSimulation());
    } catch (err) {
      console.error("Failed to start live simulation", err);
      setError("Could not start the live simulation.");
    }
  }, []);

  const stopLiveService = useCallback(async () => {
    try {
      setError(null);
      setLiveSimulation(await stopLiveSimulation());
    } catch (err) {
      console.error("Failed to stop live simulation", err);
      setError("Could not stop the live simulation.");
    }
  }, []);

  const advanceLiveService = useCallback(async () => {
    try {
      setError(null);
      setLiveSimulation(await tickLiveSimulation());
    } catch (err) {
      console.error("Failed to advance live simulation", err);
      setError("Could not advance the live simulation.");
    }
  }, []);

  const resetLiveService = useCallback(async () => {
    try {
      setError(null);
      setLiveSimulation(await resetLiveSimulation());
    } catch (err) {
      console.error("Failed to reset live simulation", err);
      setError("Could not reset the live simulation.");
    }
  }, []);

  const saveSimulationConfig = useCallback(
    async (config: Partial<LiveSimulationConfig>) => {
      try {
        setError(null);
        const nextConfig = await updateLiveSimulationConfig(config);
        setLiveSimulation((current) =>
          current ? { ...current, config: nextConfig } : current,
        );
      } catch (err) {
        console.error("Failed to save simulation config", err);
        setError("Could not save simulation settings.");
      }
    },
    [],
  );

  return (
    <SimulationContext.Provider
      value={{
        data,
        liveSimulation,
        loading,
        error,
        refresh,
        refreshLiveSimulation,
        startLiveService,
        stopLiveService,
        advanceLiveService,
        resetLiveService,
        saveSimulationConfig,
        saveInventory,
        approveOrder,
        rejectOrder,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}
