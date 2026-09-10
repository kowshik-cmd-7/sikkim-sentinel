import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/services/api";
import { generateStateGrid } from "@/utils/geoGrid";
import {
  CalculatedRiskPoint,
  StateBoundaryFeature,
  StateRiskSummary,
  NER_STATES,
} from "@/types";

// Module-level global cache to share calculated grids across pages (/assessment & /alerts)
const GLOBAL_STATE_RISK_CACHE: Record<
  string,
  { points: CalculatedRiskPoint[]; timestamp: number }
> = {};

export interface UseStateRiskGridOptions {
  storageKey?: string;
  defaultState?: string;
  onStateChangeCoordinate?: (lat: number, lng: number) => void;
}

export function useStateRiskGrid(options: UseStateRiskGridOptions = {}) {
  const {
    storageKey = "sikkim_sentinel_selected_state",
    defaultState = "Sikkim",
    onStateChangeCoordinate,
  } = options;

  const [selectedState, setSelectedState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored =
        sessionStorage.getItem(storageKey) ||
        sessionStorage.getItem("alerts_selected_state");
      if (stored && (NER_STATES as readonly string[]).includes(stored)) {
        return stored;
      }
    }
    return defaultState;
  });

  const statesQuery = useQuery({
    queryKey: ["indian-states"],
    queryFn: api.getIndianStates,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const boundaryQuery = useQuery({
    queryKey: ["state-boundary", selectedState],
    queryFn: () => api.getStateBoundary(selectedState),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const [calculatedPoints, setCalculatedPoints] = useState<CalculatedRiskPoint[]>([]);
  const [calcStatus, setCalcStatus] = useState<"idle" | "calculating" | "ready" | "error">("idle");
  const [calcProgress, setCalcProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 0,
  });
  const [selectedCalculatedPoint, setSelectedCalculatedPoint] = useState<CalculatedRiskPoint | null>(null);

  const calculationRunId = useRef<number>(0);
  const onStateChangeCoordRef = useRef(onStateChangeCoordinate);
  useEffect(() => {
    onStateChangeCoordRef.current = onStateChangeCoordinate;
  }, [onStateChangeCoordinate]);

  const calculateStateRisk = useCallback(
    async (boundary: StateBoundaryFeature, stateName: string, force = false) => {
      // Strictly enforce NER state scope (SIH 26001)
      if (!NER_STATES.includes(stateName as any)) {
        console.warn(`Blocked calculation for non-NER state: ${stateName}`);
        setCalcStatus("error");
        toast.error(`Calculation not permitted: ${stateName} is outside the North Eastern Region.`);
        return;
      }

      const currentRun = ++calculationRunId.current;
      const now = Date.now();
      const cached = GLOBAL_STATE_RISK_CACHE[stateName];

      // Use 20-minute cache if available and not forced
      if (!force && cached && now - cached.timestamp < 20 * 60 * 1000 && cached.points.length > 0) {
        setCalculatedPoints(cached.points);
        setCalcStatus("ready");
        setCalcProgress({ completed: cached.points.length, total: cached.points.length });
        return;
      }

      try {
        setCalcStatus("calculating");
        setCalculatedPoints([]);

        const grid = generateStateGrid(boundary.geometry, stateName, 24);
        if (grid.length === 0) {
          setCalcStatus("error");
          return;
        }

        setCalcProgress({ completed: 0, total: grid.length });

        const batchSize = 12;
        let accumulated: CalculatedRiskPoint[] = [];

        for (let i = 0; i < grid.length; i += batchSize) {
          if (calculationRunId.current !== currentRun) return;

          const chunk = grid.slice(i, i + batchSize);
          const results = await api.evaluateRiskGridBatch(chunk, force, stateName);

          if (calculationRunId.current !== currentRun) return;

          accumulated = [...accumulated, ...results];
          setCalculatedPoints([...accumulated]);
          setCalcProgress({ completed: accumulated.length, total: grid.length });
        }

        if (calculationRunId.current === currentRun) {
          GLOBAL_STATE_RISK_CACHE[stateName] = {
            points: accumulated,
            timestamp: Date.now(),
          };
          setCalcStatus("ready");

          const firstPoint = accumulated[0];
          if (firstPoint && onStateChangeCoordRef.current) {
            onStateChangeCoordRef.current(firstPoint.latitude, firstPoint.longitude);
          }
        }
      } catch (err) {
        if (calculationRunId.current === currentRun) {
          console.error("Error calculating state risk grid:", err);
          setCalcStatus("error");
          toast.error(`Unable to calculate complete risk grid for ${stateName}.`);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (boundaryQuery.data) {
      calculateStateRisk(boundaryQuery.data, selectedState);
    }
  }, [boundaryQuery.data, selectedState, calculateStateRisk]);

  const handleStateChange = useCallback(
    (newState: string) => {
      if (newState === selectedState) return;
      if (!NER_STATES.includes(newState as any)) {
        console.warn(`Blocked attempt to select non-NER state: ${newState}`);
        toast.error(`Invalid state selection: ${newState} is outside the North Eastern Region.`);
        return;
      }
      setSelectedState(newState);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(storageKey, newState);
        sessionStorage.setItem("alerts_selected_state", newState);
      }
      setSelectedCalculatedPoint(null);
      setCalculatedPoints([]);
      setCalcStatus("idle");
    },
    [selectedState, storageKey]
  );

  const handleRefresh = useCallback(() => {
    if (boundaryQuery.data) {
      calculateStateRisk(boundaryQuery.data, selectedState, true);
    } else {
      boundaryQuery.refetch();
    }
  }, [boundaryQuery, calculateStateRisk, selectedState]);

  const stateSummary: StateRiskSummary = useMemo(() => {
    const valid = calculatedPoints.filter((p) => p.riskScore !== null && !isNaN(p.riskScore));
    const highest = valid.length > 0 ? Math.max(...valid.map((p) => p.riskScore!)) : 0;
    return {
      stateName: selectedState,
      assessedCount: calculatedPoints.length,
      lowCount: valid.filter((p) => (p.riskScore || 0) < 40).length,
      moderateCount: valid.filter(
        (p) => (p.riskScore || 0) >= 40 && (p.riskScore || 0) < 60
      ).length,
      highCount: valid.filter(
        (p) => (p.riskScore || 0) >= 60 && (p.riskScore || 0) < 80
      ).length,
      veryHighCount: valid.filter((p) => (p.riskScore || 0) >= 80).length,
      highestRisk: highest,
    };
  }, [calculatedPoints, selectedState]);

  return {
    selectedState,
    statesQuery,
    boundaryQuery,
    calculatedPoints,
    calcStatus,
    calcProgress,
    selectedCalculatedPoint,
    setSelectedCalculatedPoint,
    stateSummary,
    handleStateChange,
    handleRefresh,
    calculateStateRisk,
  };
}
