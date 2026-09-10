import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  FeatureGroup,
  GeoJSON,
  MapContainer,
  Popup,
  Rectangle,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type {
  CalculatedRiskPoint,
  FieldReport,
  LandslideEvent,
  MonitoringRiskPoint,
  RiskCell,
  StateBoundaryFeature,
} from "@/types";
import { RISK_COLORS, RISK_LABELS, formatDate } from "@/utils/risk";
import { SIKKIM_CENTER } from "@/data/sikkim";
import { calculateBoundingBox, isPointInGeometry } from "@/utils/geoGrid";

function getFieldReportColor(severity: string): string {
  const s = severity.toLowerCase();
  if (s.includes("crit") || s === "very-high" || s === "very high") return "#dc2626";
  if (s === "high") return "#ea580c";
  if (s === "moderate" || s === "medium") return "#eab308";
  if (s === "low") return "#10b981";
  return "#38bdf8";
}

function ClickHandler({ onPick }: { onPick?: ((lat: number, lng: number) => void) | undefined }) {
  useMapEvents({
    click(e) {
      onPick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapRecenter({ center }: { center?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

function MapFitBounds({ boundary }: { boundary?: StateBoundaryFeature | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!boundary || !boundary.geometry) return;
    try {
      const bbox = calculateBoundingBox(boundary.geometry);
      const corner1: [number, number] = [bbox.minLat, bbox.minLng];
      const corner2: [number, number] = [bbox.maxLat, bbox.maxLng];
      map.fitBounds([corner1, corner2], { padding: [24, 24], animate: true, maxZoom: 11 });
    } catch (e) {
      console.warn("Failed to fit bounds to boundary:", e);
    }
  }, [boundary, map]);
  return null;
}

export interface AlertCircleConfig {
  center: [number, number];
  radiusKm: number;
  color?: string;
  severity?: string;
  label?: string;
}

function getPointStyle(score: number | null | undefined) {
  if (score === null || score === undefined || isNaN(score)) {
    return {
      color: "#64748b",
      fillColor: "#64748b",
      level: "INSUFFICIENT DATA",
      textColor: "text-slate-400",
      bgBadge: "bg-slate-800 text-slate-300 border-slate-700",
    };
  }
  // Standardized Risk Levels:
  // LOW: 0-39 | MODERATE: 40-59 | HIGH: 60-79 | VERY HIGH: 80-100
  if (score >= 80) {
    return {
      color: "#dc2626", // crimson red
      fillColor: "#dc2626",
      level: "VERY HIGH",
      textColor: "text-red-400",
      bgBadge: "bg-red-950/90 text-red-300 border-red-800",
    };
  }
  if (score >= 60) {
    return {
      color: "#ea580c", // orange-red
      fillColor: "#ea580c",
      level: "HIGH",
      textColor: "text-orange-400",
      bgBadge: "bg-orange-950/90 text-orange-300 border-orange-800",
    };
  }
  if (score >= 40) {
    return {
      color: "#eab308", // amber/yellow
      fillColor: "#eab308",
      level: "MODERATE",
      textColor: "text-yellow-400",
      bgBadge: "bg-yellow-950/90 text-yellow-300 border-yellow-800",
    };
  }
  return {
    color: "#10b981", // green
    fillColor: "#10b981",
    level: "LOW",
    textColor: "text-emerald-400",
    bgBadge: "bg-emerald-950/90 text-emerald-300 border-emerald-800",
  };
}

export default function RiskMap({
  events = [],
  cells = [],
  showGrid = true,
  showEvents = true,
  height = 520,
  zoom = 8,
  onPick,
  marker,
  alertCircle,
  heatPoints,
  calculatedRiskPoints,
  stateBoundary,
  selectedPointId,
  onSelectPoint,
  onSelectCalculatedPoint,
  fieldReports,
  selectedReportId,
  onSelectFieldReport,
  markerLabel,
}: {
  events?: LandslideEvent[];
  cells?: RiskCell[];
  showGrid?: boolean;
  showEvents?: boolean;
  height?: number;
  zoom?: number;
  onPick?: (lat: number, lng: number) => void;
  marker?: [number, number] | null;
  alertCircle?: AlertCircleConfig | null;
  heatPoints?: MonitoringRiskPoint[] | undefined;
  calculatedRiskPoints?: CalculatedRiskPoint[] | undefined;
  stateBoundary?: StateBoundaryFeature | null | undefined;
  selectedPointId?: string | null | undefined;
  onSelectPoint?: ((point: MonitoringRiskPoint) => void) | undefined;
  onSelectCalculatedPoint?: ((point: CalculatedRiskPoint) => void) | undefined;
  fieldReports?: FieldReport[] | undefined;
  selectedReportId?: string | null | undefined;
  onSelectFieldReport?: ((report: FieldReport) => void) | undefined;
  markerLabel?: string | undefined;
}) {
  const circleCenter = alertCircle?.center ?? marker ?? SIKKIM_CENTER;
  const circleColor = alertCircle?.color || (alertCircle?.severity === "VERY_HIGH" ? "#dc2626" : "#ea580c");

  // Determine if marker and alertCircle are inside the selected state boundary
  const isPointInActiveState = (pt: [number, number]): boolean => {
    if (!stateBoundary || !stateBoundary.geometry) return true;
    return isPointInGeometry([pt[1], pt[0]], stateBoundary.geometry);
  };

  const showAlertCircle = alertCircle && isPointInActiveState(alertCircle.center);
  const showSelectedMarker = marker && isPointInActiveState(marker);

  // Filter historical events to active state
  const visibleEvents = events.filter((e) => isPointInActiveState([e.lat, e.lng]));

  // Filter field reports to active state
  const visibleFieldReports = (fieldReports || []).filter((r) =>
    isPointInActiveState([r.latitude, r.longitude]),
  );

  return (
    <MapContainer
      center={circleCenter}
      zoom={zoom}
      scrollWheelZoom
      style={{ height, width: "100%", background: "#0b1220" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <MapRecenter center={showSelectedMarker ? marker : showAlertCircle ? alertCircle?.center : null} />
      <MapFitBounds boundary={stateBoundary} />

      {/* Official State Boundary Layer */}
      {stateBoundary && stateBoundary.geometry && (
        <GeoJSON
          key={stateBoundary.properties?.STNAME || stateBoundary.properties?.["name"] || "active-boundary"}
          data={stateBoundary as any}
          style={() => ({
            color: "#38bdf8",
            weight: 2.5,
            opacity: 0.95,
            fillColor: "#0284c7",
            fillOpacity: 0.05,
            dashArray: "3, 3",
          })}
        />
      )}

      {/* Dynamic State Calculated Risk Points */}
      {calculatedRiskPoints &&
        calculatedRiskPoints.map((p, idx) => {
          const style = getPointStyle(p.riskScore);
          const pKey = `calc-point-${p.latitude.toFixed(4)}-${p.longitude.toFixed(4)}-${idx}`;
          const isSelected = selectedPointId === pKey;

          return (
            <FeatureGroup key={pKey}>
              {/* Outer influence halo (Risk intensity) */}
              <Circle
                center={[p.latitude, p.longitude]}
                radius={11000}
                pathOptions={{
                  color: style.color,
                  fillColor: style.fillColor,
                  fillOpacity: 0.12,
                  weight: 0,
                }}
              />

              {/* Mid gradient hotspot */}
              <Circle
                center={[p.latitude, p.longitude]}
                radius={5500}
                pathOptions={{
                  color: style.color,
                  fillColor: style.fillColor,
                  fillOpacity: 0.22,
                  weight: 1,
                  dashArray: "3, 4",
                }}
              />

              {/* Center Epicenter Marker */}
              <CircleMarker
                center={[p.latitude, p.longitude]}
                radius={isSelected ? 10 : 7}
                pathOptions={{
                  color: isSelected ? "#ffffff" : style.color,
                  fillColor: style.color,
                  fillOpacity: 0.95,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{
                  click: () => onSelectCalculatedPoint?.(p),
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div className="text-xs font-semibold">
                    {p.locationName || `Location (${p.latitude.toFixed(2)}°, ${p.longitude.toFixed(2)}°)`}
                  </div>
                  <div className="text-[11px]">
                    Risk Score: {p.riskScore !== null ? `${p.riskScore.toFixed(1)}/100` : "N/A"} ({style.level})
                  </div>
                </Tooltip>

                <Popup>
                  <div style={{ minWidth: 230, color: "#f8fafc", fontFamily: "inherit" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>{p.locationName || "Calculated Grid Point"}</strong>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {p.latitude.toFixed(3)}°N, {p.longitude.toFixed(3)}°E
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: style.color,
                          color: "#ffffff",
                        }}
                      >
                        {style.level}
                      </span>
                    </div>

                    <div style={{ background: "#1e293b", padding: 8, borderRadius: 6, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#94a3b8" }}>Hybrid Landslide Risk:</span>
                        <strong style={{ color: style.color }}>
                          {p.riskScore !== null ? `${p.riskScore.toFixed(1)} / 100` : "Insufficient Data"}
                        </strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid #334155", paddingTop: 4 }}>
                        <span style={{ color: "#94a3b8" }}>Rainfall ML Risk:</span>
                        <strong>{p.rainfallRiskScore !== null && p.rainfallRiskScore !== undefined ? `${p.rainfallRiskScore.toFixed(1)}` : "N/A"}</strong>
                      </div>
                    </div>

                    <div style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>
                      <div>
                        <strong>Rainfall (7d):</strong> {p.rainfall7d !== null && p.rainfall7d !== undefined ? `${p.rainfall7d.toFixed(1)} mm` : "N/A"}
                      </div>
                      <div>
                        <strong>Terrain:</strong> {p.elevation !== null && p.elevation !== undefined ? `${Math.round(p.elevation)} m` : "N/A"} elev ·{" "}
                        {p.slope !== null && p.slope !== undefined ? `${p.slope.toFixed(1)}°` : "N/A"} slope (
                        {p.terrainSusceptibility || "Moderate"})
                      </div>
                    </div>

                    <div style={{ fontSize: 9.5, color: "#64748b", borderTop: "1px solid #334155", paddingTop: 4 }}>
                      Calculated from Open-Meteo rainfall, Copernicus 90m DEM & trained GradientBoostingRegressor.
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </FeatureGroup>
          );
        })}

      {/* Predefined Monitoring Watchpoints (when in heatPoints mode) */}
      {(!calculatedRiskPoints || calculatedRiskPoints.length === 0) &&
        heatPoints &&
        heatPoints.map((p) => {
          const style = getPointStyle(p.currentRisk);
          const isSelected = selectedPointId === p.id;
          return (
            <FeatureGroup key={p.id}>
              <Circle
                center={[p.latitude, p.longitude]}
                radius={7500}
                pathOptions={{
                  color: style.color,
                  fillColor: style.fillColor,
                  fillOpacity: 0.12,
                  weight: 0,
                }}
              />
              <Circle
                center={[p.latitude, p.longitude]}
                radius={3800}
                pathOptions={{
                  color: style.color,
                  fillColor: style.fillColor,
                  fillOpacity: 0.22,
                  weight: 1,
                  dashArray: "3, 4",
                }}
              />
              <CircleMarker
                center={[p.latitude, p.longitude]}
                radius={isSelected ? 11 : 8}
                pathOptions={{
                  color: isSelected ? "#ffffff" : style.color,
                  fillColor: style.color,
                  fillOpacity: 0.95,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{
                  click: () => onSelectPoint?.(p),
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div className="text-xs font-semibold">{p.locationName}</div>
                  <div className="text-[11px]">
                    Current Risk: {p.currentRisk !== null ? `${p.currentRisk.toFixed(1)}/100` : "N/A"} ({style.level})
                  </div>
                </Tooltip>

                <Popup>
                  <div style={{ minWidth: 230, color: "#f8fafc", fontFamily: "inherit" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>{p.locationName}</strong>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.district} District</div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: style.color,
                          color: "#ffffff",
                        }}
                      >
                        {style.level}
                      </span>
                    </div>

                    <div style={{ background: "#1e293b", padding: 8, borderRadius: 6, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#94a3b8" }}>Current Hybrid Risk:</span>
                        <strong style={{ color: style.color }}>
                          {p.currentRisk !== null ? `${p.currentRisk.toFixed(1)} / 100` : "Insufficient Data"}
                        </strong>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, borderTop: "1px solid #334155", paddingTop: 4 }}>
                        <div><span style={{ color: "#94a3b8" }}>Next 6h:</span> <strong>{p.risk6h !== null ? `${p.risk6h.toFixed(1)}` : "N/A"}</strong></div>
                        <div><span style={{ color: "#94a3b8" }}>Next 24h:</span> <strong>{p.risk24h !== null ? `${p.risk24h.toFixed(1)}` : "N/A"}</strong></div>
                        <div><span style={{ color: "#94a3b8" }}>Next 48h:</span> <strong>{p.risk48h !== null ? `${p.risk48h.toFixed(1)}` : "N/A"}</strong></div>
                        <div><span style={{ color: "#94a3b8" }}>Next 72h:</span> <strong>{p.risk72h !== null ? `${p.risk72h.toFixed(1)}` : "N/A"}</strong></div>
                      </div>
                    </div>

                    <div style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>
                      <div><strong>Rainfall:</strong> 7-day cumulative: {p.rainfall7d !== null ? `${p.rainfall7d.toFixed(1)} mm` : "N/A"}</div>
                      <div>
                        <strong>Terrain:</strong> {p.elevation !== null ? `${Math.round(p.elevation)} m` : "N/A"} elev ·{" "}
                        {p.slope !== null ? `${p.slope.toFixed(1)}°` : "N/A"} slope ({p.terrainSusceptibility} susceptibility)
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </FeatureGroup>
          );
        })}

      {/* Fallback legacy cells if neither heatPoints nor calculatedRiskPoints provided */}
      {(!heatPoints || heatPoints.length === 0) &&
        (!calculatedRiskPoints || calculatedRiskPoints.length === 0) &&
        showGrid &&
        cells.map((c) => (
          <Rectangle
            key={c.id}
            bounds={[
              [c.lat, c.lng],
              [c.lat + c.size, c.lng + c.size],
            ]}
            pathOptions={{
              color: RISK_COLORS[c.level],
              weight: 0.4,
              fillColor: RISK_COLORS[c.level],
              fillOpacity: 0.25 + (c.score / 100) * 0.3,
            }}
          >
            <Tooltip>
              DEMO cell — {RISK_LABELS[c.level]} ({c.score}/100)
            </Tooltip>
          </Rectangle>
        ))}

      {showEvents &&
        visibleEvents.map((e) => (
          <CircleMarker
            key={e.id}
            center={[e.lat, e.lng]}
            radius={7}
            pathOptions={{
              color: "#ffffff",
              weight: 1.5,
              fillColor: RISK_COLORS[e.severity],
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <div style={{ minWidth: 190 }}>
                <strong>{e.location}</strong>
                <div>{e.district}</div>
                <div>{formatDate(e.date)}</div>
                <div>
                  Severity: {RISK_LABELS[e.severity]} · Trigger: {e.trigger}
                </div>
                <div>Fatalities: {e.fatalities}</div>
                <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>{e.notes}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

      {/* Field Reports Geo-Tagged Markers */}
      {visibleFieldReports.map((report) => {
        const color = getFieldReportColor(report.severity);
        const isSelected = selectedReportId === report.id;
        return (
          <CircleMarker
            key={report.id}
            center={[report.latitude, report.longitude]}
            radius={isSelected ? 11 : 8}
            pathOptions={{
              color: isSelected ? "#ffffff" : color,
              fillColor: color,
              fillOpacity: 0.92,
              weight: isSelected ? 3 : 2,
            }}
            eventHandlers={{
              click: () => onSelectFieldReport?.(report),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div className="text-xs font-semibold">{report.category}</div>
              <div className="text-[11px]">
                Severity: <strong>{report.severity}</strong> · Status: {report.status}
              </div>
              <div className="text-[10px] opacity-75">
                {report.latitude.toFixed(4)}°, {report.longitude.toFixed(4)}°
              </div>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 220, color: "#f8fafc", fontFamily: "inherit" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <strong style={{ fontSize: 13 }}>{report.category}</strong>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: color,
                      color: "#ffffff",
                    }}
                  >
                    {report.severity}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
                  {report.district ? `${report.district} · ` : ""}
                  {new Date(report.timestamp).toLocaleString([], {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
                <p style={{ fontSize: 12, margin: "6px 0", color: "#e2e8f0", lineHeight: 1.4 }}>
                  {report.description}
                </p>
                {report.photo && (
                  <div
                    style={{
                      margin: "8px 0",
                      maxHeight: 120,
                      overflow: "hidden",
                      borderRadius: 6,
                      border: "1px solid #334155",
                    }}
                  >
                    <img
                      src={report.photo}
                      alt="Observation attachment"
                      style={{ width: "100%", height: "auto", display: "block" }}
                    />
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 11,
                    marginTop: 8,
                    paddingTop: 6,
                    borderTop: "1px solid #334155",
                  }}
                >
                  <span style={{ color: "#94a3b8" }}>
                    Status: <strong style={{ color: "#38bdf8" }}>{report.status}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectFieldReport?.(report)}
                    style={{
                      background: "#0284c7",
                      color: "#ffffff",
                      border: "none",
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Potentially Affected Monitoring Zone Circle */}
      {showAlertCircle && (
        <Circle
          center={alertCircle.center}
          radius={alertCircle.radiusKm * 1000}
          pathOptions={{
            color: circleColor,
            fillColor: circleColor,
            fillOpacity: 0.18,
            weight: 2,
            dashArray: "6, 6",
          }}
        >
          <Tooltip permanent={false}>
            {alertCircle.label || `Potentially Affected Zone (${alertCircle.radiusKm} km radius)`}
          </Tooltip>
        </Circle>
      )}

      {/* Selected Marker */}
      {showSelectedMarker && (
        <CircleMarker
          center={marker}
          radius={10}
          pathOptions={{
            color: showAlertCircle ? circleColor : "#38bdf8",
            fillColor: showAlertCircle ? circleColor : "#38bdf8",
            weight: 3,
            fillOpacity: 0.4,
          }}
        >
          <Tooltip permanent>
            {markerLabel || alertCircle?.label || "Selected monitoring coordinate"}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
