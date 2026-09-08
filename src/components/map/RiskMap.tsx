import "leaflet/dist/leaflet.css";
import {
  CircleMarker,
  MapContainer,
  Popup,
  Rectangle,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import type { LandslideEvent, RiskCell } from "@/types";
import { RISK_COLORS, RISK_LABELS, formatDate } from "@/utils/risk";
import { SIKKIM_CENTER } from "@/data/sikkim";

function ClickHandler({ onPick }: { onPick?: ((lat: number, lng: number) => void) | undefined }) {
  useMapEvents({
    click(e) {
      onPick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function RiskMap({
  events = [],
  cells = [],
  showGrid = true,
  showEvents = true,
  height = 520,
  zoom = 9,
  onPick,
  marker,
}: {
  events?: LandslideEvent[];
  cells?: RiskCell[];
  showGrid?: boolean;
  showEvents?: boolean;
  height?: number;
  zoom?: number;
  onPick?: (lat: number, lng: number) => void;
  marker?: [number, number] | null;
}) {
  return (
    <MapContainer
      center={SIKKIM_CENTER}
      zoom={zoom}
      scrollWheelZoom
      style={{ height, width: "100%", background: "#0b1220" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />

      {showGrid &&
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
        events.map((e) => (
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

      {marker && (
        <CircleMarker
          center={marker}
          radius={10}
          pathOptions={{ color: "#38bdf8", weight: 3, fillOpacity: 0.2 }}
        >
          <Tooltip permanent>Selected point</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
