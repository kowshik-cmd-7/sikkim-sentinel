import { evaluateLandslideAlert } from "../src/services/alertEngine.ts";
import { findNearbyFacilities, SIKKIM_FACILITIES } from "../src/data/facilities.ts";

console.log("=================================================");
console.log("SIKKIM SENTINEL - ALERT & EARLY WARNING TEST SUITE");
console.log("=================================================");

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// TEST 1: Facilities dataset & Geocoding Haversine
// -------------------------------------------------------------
console.log("\n--- TEST 1: Facilities Dataset & Proximity ---");
assert(SIKKIM_FACILITIES.length >= 25, `Facilities dataset has ${SIKKIM_FACILITIES.length} facilities (>= 25)`);

// Gangtok centre: (27.3314, 88.6138)
const gtkFacilities = findNearbyFacilities(27.3314, 88.6138, 10);
assert(gtkFacilities.length > 0, `Found ${gtkFacilities.length} facilities within 10km of Gangtok`);
const firstGtk = gtkFacilities[0];
assert(firstGtk.type === "authority", `Top prioritized facility is an authority: ${firstGtk.name}`);
assert(firstGtk.distance_km <= 1.0, `Gangtok SEOC is within 1km (${firstGtk.distance_km}km)`);

// -------------------------------------------------------------
// TEST 2: Low-Risk Location (Siliguri Plains)
// -------------------------------------------------------------
console.log("\n--- TEST 2: Normal Conditions / Low Risk ---");
const lowEval = evaluateLandslideAlert({
  lat: 26.72,
  lng: 88.43,
  district: "Plains",
  currentRisk: 14.5,
  currentLevel: "low",
  horizons: [
    { horizon: "6h", label: "Next 6 Hours", score: 14.8, level: "low", rainfallMm: 0.2 },
    { horizon: "24h", label: "Next 24 Hours", score: 15.1, level: "low", rainfallMm: 0.8 },
    { horizon: "48h", label: "Next 48 Hours", score: 16.0, level: "low", rainfallMm: 1.5 },
    { horizon: "72h", label: "Next 72 Hours", score: 16.2, level: "low", rainfallMm: 2.0 },
  ],
  terrain: {
    latitude: 26.72,
    longitude: 88.43,
    elevation_m: 120,
    slope_degrees: 1.2,
    slope_category: "Flat",
    terrain_susceptibility: "Low",
    data_source: "Open-Meteo DEM",
  },
  rainfall: {
    rainfall_1d: 0.2,
    rainfall_3d: 1.5,
    rainfall_7d: 4.2,
    rainfall_14d: 12.0,
    rainfall_30d: 25.0,
  },
  radiusKm: 15,
});

assert(lowEval.shouldAlert === false, "Low risk yields shouldAlert = false");
assert(lowEval.severity === null, "Low risk severity is null");
assert(lowEval.alert === null, "Low risk produces no alert dispatch");
assert(lowEval.triggerReason.includes("Normal Conditions"), "Trigger reason specifies Normal Conditions");

// -------------------------------------------------------------
// TEST 3: High-Altitude / Mountain Steep Slope Active Alert
// -------------------------------------------------------------
console.log("\n--- TEST 3: Critical Landslide Alert Evaluation ---");
const criticalEval = evaluateLandslideAlert({
  lat: 27.8174,
  lng: 88.4778,
  district: "Mangan",
  currentRisk: 79.5,
  currentLevel: "very-high",
  horizons: [
    { horizon: "6h", label: "Next 6 Hours", score: 81.2, level: "very-high", rainfallMm: 12.5 },
    { horizon: "24h", label: "Next 24 Hours", score: 84.0, level: "very-high", rainfallMm: 38.0 },
  ],
  terrain: {
    latitude: 27.8174,
    longitude: 88.4778,
    elevation_m: 3978,
    slope_degrees: 54.6,
    slope_category: "Very Steep",
    terrain_susceptibility: "Very High",
    data_source: "Open-Meteo DEM",
  },
  rainfall: {
    rainfall_1d: 54.6,
    rainfall_3d: 211.7,
    rainfall_7d: 551.3,
    rainfall_14d: 901.8,
    rainfall_30d: 1123.1,
  },
  radiusKm: 25,
});

assert(criticalEval.shouldAlert === true, "Critical evaluation yields shouldAlert = true");
assert(criticalEval.severity === "CRITICAL", "Critical severity is CRITICAL");
assert(criticalEval.alert !== null, "LandslideAlert object generated");
assert(criticalEval.alert?.slope === 54.6, "Alert contains correct slope: 54.6°");
assert(criticalEval.alert?.elevation === 3978, "Alert contains correct elevation: 3978m");
assert(criticalEval.alert?.recipients.length > 0, `Alert recipients generated: ${criticalEval.alert?.recipients.length}`);
assert(criticalEval.alert?.recommendedActions.length >= 4, "Includes SOP action items");
assert(criticalEval.alert?.isDemo === true, "Alert correctly marked as isDemo = true");

// Check recipient priority ordering
const recipients = criticalEval.alert?.recipients || [];
const priorities = recipients.map((r) => r.priority);
const isSorted = priorities.every((val, i, arr) => !i || arr[i - 1] <= val);
assert(isSorted, `Recipients properly ordered by priority (Authorities: 1, Health: 2, Schools: 3)`);

// -------------------------------------------------------------
// TEST 4: Multi-Horizon Escalation Early Warning
// -------------------------------------------------------------
console.log("\n--- TEST 4: Multi-Horizon Escalation Synthesis ---");
// Current is Moderate (38.0), but 24h jumps to High (64.2)
const escalationEval = evaluateLandslideAlert({
  lat: 27.33,
  lng: 88.61,
  district: "Gangtok",
  currentRisk: 38.0,
  currentLevel: "moderate",
  horizons: [
    { horizon: "6h", label: "+6 Hours", score: 42.0, level: "moderate", rainfallMm: 8.0 },
    { horizon: "24h", label: "+24 Hours", score: 64.2, level: "high", rainfallMm: 45.0 },
    { horizon: "48h", label: "+48 Hours", score: 68.0, level: "high", rainfallMm: 62.0 },
  ],
  radiusKm: 10,
});

assert(escalationEval.shouldAlert === true, "Escalating risk triggers early warning");
assert(escalationEval.severity === "WARNING", "Escalation severity is WARNING");
assert(escalationEval.alert?.title.includes("EARLY WARNING"), `Title is Early Warning: "${escalationEval.alert?.title}"`);
assert(escalationEval.alert?.forecastHorizon === "48h" || escalationEval.alert?.forecastHorizon === "24h", "Trigger horizon identified");

// -------------------------------------------------------------
// TEST 5: Configurable Radius Expansion
// -------------------------------------------------------------
console.log("\n--- TEST 5: Configurable Radius Filtering ---");
const r5 = findNearbyFacilities(27.3314, 88.6138, 5);
const r25 = findNearbyFacilities(27.3314, 88.6138, 25);
assert(r25.length >= r5.length, `Expanded radius increases facility count (5km: ${r5.length}, 25km: ${r25.length})`);

console.log("\n=================================================");
console.log(`RESULTS: ${passCount} passed, ${failCount} failed.`);
console.log("=================================================");
if (failCount > 0) process.exit(1);
