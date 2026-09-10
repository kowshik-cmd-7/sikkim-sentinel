/**
 * Spatial Grid Utilities for State-Selectable Landslide Risk Heatmap
 * Implements Ray-Casting Point-in-Polygon (Polygon & MultiPolygon)
 * and adaptive grid sampling across Indian state boundaries.
 */

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * Extracts bounding box [minLng, minLat, maxLng, maxLat] from GeoJSON Polygon or MultiPolygon.
 */
export function calculateBoundingBox(geometry: { type: string; coordinates: any }): BoundingBox {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function processCoords(coords: any) {
    if (Array.isArray(coords) && typeof coords[0] === "number" && typeof coords[1] === "number") {
      const lng = coords[0];
      const lat = coords[1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) {
      for (const sub of coords) {
        processCoords(sub);
      }
    }
  }

  processCoords(geometry.coordinates);

  return {
    minLng: minLng === Infinity ? 88.0 : minLng,
    minLat: minLat === Infinity ? 27.0 : minLat,
    maxLng: maxLng === -Infinity ? 89.0 : maxLng,
    maxLat: maxLat === -Infinity ? 28.0 : maxLat,
  };
}

/**
 * Ray-casting algorithm to test if [lng, lat] is inside a polygon linear ring.
 */
function isPointInLinearRing(point: [number, number], ring: number[][]): boolean {
  const [lng, lat] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ptI = ring[i];
    const ptJ = ring[j];
    if (!ptI || !ptJ) continue;

    const xi = ptI[0] ?? 0;
    const yi = ptI[1] ?? 0;
    const xj = ptJ[0] ?? 0;
    const yj = ptJ[1] ?? 0;

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks if a point [lng, lat] is inside a GeoJSON Polygon (considering holes).
 */
export function isPointInPolygon(point: [number, number], rings: number[][][]): boolean {
  if (!rings || rings.length === 0 || !rings[0]) return false;
  // Must be inside exterior ring
  if (!isPointInLinearRing(point, rings[0])) {
    return false;
  }
  // Must NOT be inside any interior ring (holes)
  for (let i = 1; i < rings.length; i++) {
    const hole = rings[i];
    if (hole && isPointInLinearRing(point, hole)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a point [lng, lat] is inside a GeoJSON MultiPolygon.
 */
export function isPointInMultiPolygon(point: [number, number], multiRings: number[][][][]): boolean {
  if (!multiRings || multiRings.length === 0) return false;
  for (const polyRings of multiRings) {
    if (polyRings && isPointInPolygon(point, polyRings)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if [lng, lat] is inside the given geometry (Polygon or MultiPolygon).
 */
export function isPointInGeometry(point: [number, number], geometry: { type: string; coordinates: any }): boolean {
  if (!geometry || !geometry.coordinates) return false;
  if (geometry.type === "Polygon") {
    return isPointInPolygon(point, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return isPointInMultiPolygon(point, geometry.coordinates);
  }
  return false;
}

export interface GridSamplePoint {
  latitude: number;
  longitude: number;
  name: string;
}

/**
 * Generates an adaptive sampling grid over the state's geographic extent.
 * Produces ~15 to 35 points strictly within the state boundary.
 */
export function generateStateGrid(
  geometry: { type: string; coordinates: any },
  stateName = "State",
  targetPoints = 25,
): GridSamplePoint[] {
  const bbox = calculateBoundingBox(geometry);
  const lngSpan = bbox.maxLng - bbox.minLng;
  const latSpan = bbox.maxLat - bbox.minLat;

  if (lngSpan <= 0 || latSpan <= 0) {
    return [];
  }

  // Initial step estimate based on span
  let divisor = 6;
  if (latSpan > 4 || lngSpan > 4) {
    divisor = 8;
  }
  let stepLng = Math.max(0.12, lngSpan / divisor);
  let stepLat = Math.max(0.12, latSpan / divisor);

  // Collect candidate points inside polygon
  function collectPoints(sLng: number, sLat: number): GridSamplePoint[] {
    const pts: GridSamplePoint[] = [];
    const padLng = sLng * 0.4;
    const padLat = sLat * 0.4;

    for (let lat = bbox.minLat + padLat; lat <= bbox.maxLat - padLat * 0.5; lat += sLat) {
      for (let lng = bbox.minLng + padLng; lng <= bbox.maxLng - padLng * 0.5; lng += sLng) {
        const roundedLat = Number(lat.toFixed(4));
        const roundedLng = Number(lng.toFixed(4));

        if (isPointInGeometry([roundedLng, roundedLat], geometry)) {
          pts.push({
            latitude: roundedLat,
            longitude: roundedLng,
            name: `${stateName} (${roundedLat.toFixed(2)}°N, ${roundedLng.toFixed(2)}°E)`,
          });
        }
      }
    }
    return pts;
  }

  let points = collectPoints(stepLng, stepLat);

  // If too few points (< 10), make grid finer
  if (points.length < 12 && (stepLng > 0.1 || stepLat > 0.1)) {
    stepLng = Math.max(0.09, stepLng * 0.72);
    stepLat = Math.max(0.09, stepLat * 0.72);
    const finer = collectPoints(stepLng, stepLat);
    if (finer.length > 0) points = finer;
  }

  // If too many points (> 40), make grid coarser
  if (points.length > 40) {
    stepLng = stepLng * 1.35;
    stepLat = stepLat * 1.35;
    const coarser = collectPoints(stepLng, stepLat);
    if (coarser.length >= 10) points = coarser;
  }

  // Hard cap to 36 sample points maximum
  if (points.length > 36) {
    points = points.slice(0, 36);
  }

  return points;
}
