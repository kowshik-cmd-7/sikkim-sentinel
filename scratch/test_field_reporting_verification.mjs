import assert from "node:assert";

const BACKEND_URL = "http://127.0.0.1:8000";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING FIELD REPORTING & GEO-TAGGING VERIFICATION");
  console.log("==================================================");

  // 1. Health check
  console.log("\n[1/5] Checking Backend Health...");
  const healthRes = await fetch(`${BACKEND_URL}/health`);
  assert.strictEqual(healthRes.status, 200, "Health endpoint should return 200");
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.status, "ok");
  assert.strictEqual(healthData.model_loaded, true);
  console.log("  ✓ Backend health verified. ML model is loaded and ready.");

  // 2. GET /field-reports
  console.log("\n[2/5] Testing GET /field-reports...");
  const listRes = await fetch(`${BACKEND_URL}/field-reports`);
  assert.strictEqual(listRes.status, 200, "List reports should return 200");
  const initialReports = await listRes.json();
  assert(Array.isArray(initialReports), "Reports should be an array");
  assert(initialReports.length >= 4, "Should contain at least 4 seeded reports");
  console.log(`  ✓ Received ${initialReports.length} seeded field reports.`);
  console.log(`    Sample seed: [${initialReports[0].category}] ${initialReports[0].description.slice(0, 60)}...`);

  // 3. POST /field-reports (New Observation with Geo-Tag)
  console.log("\n[3/5] Testing POST /field-reports (Geo-Tagged Submission)...");
  const testPayload = {
    latitude: 27.5074,
    longitude: 88.5222,
    category: "Slope Crack",
    severity: "Critical",
    description: "Automated verification: severe tension fissure along bypass road. Road shoulder cracked.",
    photo: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...",
    reporter_name: "Field Officer Tashi - BRO Unit",
    district: "Mangan",
    state: "Sikkim",
  };

  const createRes = await fetch(`${BACKEND_URL}/field-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testPayload),
  });
  assert.strictEqual(createRes.status, 201, "Creating report should return 201 Created");
  const createdReport = await createRes.json();
  assert(createdReport.id.startsWith("fr-"), "Report ID should have fr- prefix");
  assert.strictEqual(createdReport.category, "Slope Crack");
  assert.strictEqual(createdReport.severity, "Critical");
  assert.strictEqual(createdReport.status, "SUBMITTED");
  assert.strictEqual(createdReport.latitude, 27.5074);
  assert.strictEqual(createdReport.longitude, 88.5222);
  console.log(`  ✓ Created field report ID: ${createdReport.id}`);
  console.log(`    Location: (${createdReport.latitude}°, ${createdReport.longitude}°)`);
  console.log(`    Status: ${createdReport.status} | Severity: ${createdReport.severity}`);

  // 4. PATCH /field-reports/{id}/status (Status Progression)
  console.log("\n[4/5] Testing PATCH /field-reports/{id}/status (Lifecycle Transition)...");
  const patchRes = await fetch(`${BACKEND_URL}/field-reports/${createdReport.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "REVIEWED" }),
  });
  assert.strictEqual(patchRes.status, 200, "Status update should return 200");
  const reviewedReport = await patchRes.json();
  assert.strictEqual(reviewedReport.status, "REVIEWED");
  assert(reviewedReport.reviewed_at !== null, "reviewed_at timestamp should be set");
  console.log(`  ✓ Successfully updated status to REVIEWED. reviewed_at: ${reviewedReport.reviewed_at}`);

  // Transition to RESOLVED
  const resolveRes = await fetch(`${BACKEND_URL}/field-reports/${createdReport.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "RESOLVED" }),
  });
  assert.strictEqual(resolveRes.status, 200);
  const resolvedReport = await resolveRes.json();
  assert.strictEqual(resolvedReport.status, "RESOLVED");
  assert(resolvedReport.resolved_at !== null, "resolved_at timestamp should be set");
  console.log(`  ✓ Successfully updated status to RESOLVED. resolved_at: ${resolvedReport.resolved_at}`);

  // 5. DELETE /field-reports/{id}
  console.log("\n[5/5] Testing DELETE /field-reports/{id}...");
  const delRes = await fetch(`${BACKEND_URL}/field-reports/${createdReport.id}`, {
    method: "DELETE",
  });
  assert.strictEqual(delRes.status, 200, "Delete should return 200");
  const delBody = await delRes.json();
  assert.strictEqual(delBody.status, "success");
  assert.strictEqual(delBody.deleted_id, createdReport.id);
  console.log(`  ✓ Successfully deleted test field report ${createdReport.id}`);

  console.log("\n==================================================");
  console.log("ALL FIELD REPORTING & GEO-TAGGING TESTS PASSED! ✓");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
