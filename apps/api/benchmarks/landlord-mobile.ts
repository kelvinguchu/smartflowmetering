import { printResult, runScenario } from "./config";
import type { BenchResult, Scenario } from "./config";
import { resolveOtpCode, seedLandlordMobileBenchmarkFixture } from "./landlord-mobile.fixture";

const BASE_URL = process.env.BENCH_URL ?? "http://localhost:3000";

function parseArgs() {
  const args = process.argv.slice(2);
  let quick = false;

  for (const arg of args) {
    if (arg === "--quick") {
      quick = true;
    }
  }

  return { quick };
}

function printSummary(results: BenchResult[]) {
  console.log("\nSummary");
  console.log(
    "Scenario".padEnd(44) +
      "Req/s".padStart(8) +
      "Avg(ms)".padStart(10) +
      "p99(ms)".padStart(10) +
      "Errors".padStart(8),
  );
  console.log("-".repeat(80));

  for (const result of results) {
    const errors = result.errors + result.timeouts + result.non2xx;
    console.log(
      result.title.padEnd(44) +
        result.requests.average.toFixed(1).padStart(8) +
        result.latency.avg.toFixed(1).padStart(10) +
        String(result.latency.p99).padStart(10) +
        String(errors).padStart(8),
    );
  }
}

async function sendOtp(phoneNumber: string) {
  const response = await fetch(`${BASE_URL}/api/mobile/landlord-access/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });
  if (!response.ok) {
    throw new Error(`send-otp failed with ${response.status}`);
  }
}

async function verifyOtp(phoneNumber: string, code: string) {
  const response = await fetch(`${BASE_URL}/api/mobile/landlord-access/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, phoneNumber }),
  });
  if (!response.ok) {
    throw new Error(`verify-otp failed with ${response.status}`);
  }

  const body = (await response.json()) as { data: { token: string } };
  return body.data.token;
}

function buildScenarios(token: string, propertyId: string, quick: boolean): Scenario[] {
  const headers = { Authorization: `Bearer ${token}` };
  const amount = quick ? 10 : 30;
  const connections = quick ? 1 : 2;

  return [
    {
      title: "Landlord property analytics summary",
      path: `/api/mobile/landlord-access/properties/${propertyId}/analytics-summary`,
      headers,
      amount,
      connections,
    },
    {
      title: "Landlord property day rollups",
      path: `/api/mobile/landlord-access/properties/${propertyId}/rollups?granularity=day&limit=30`,
      headers,
      amount,
      connections,
    },
    {
      title: "Landlord property month rollups",
      path: `/api/mobile/landlord-access/properties/${propertyId}/rollups?granularity=month&limit=12`,
      headers,
      amount,
      connections,
    },
    {
      title: "Landlord mother meter comparisons",
      path: `/api/mobile/landlord-access/properties/${propertyId}/mother-meter-comparisons?limit=20`,
      headers,
      amount,
      connections,
    },
    {
      title: "Landlord timeline",
      path: `/api/mobile/landlord-access/timeline?propertyId=${propertyId}&limit=50`,
      headers,
      amount,
      connections,
    },
    {
      title: "Landlord thresholds",
      path: `/api/mobile/landlord-access/thresholds/mother-meters?propertyId=${propertyId}`,
      headers,
      amount,
      connections,
    },
  ];
}

async function ensureServer() {
  const response = await fetch(`${BASE_URL}/api/health`);
  if (!response.ok) {
    throw new Error(`Cannot reach ${BASE_URL}/api/health`);
  }
}

async function main() {
  const { quick } = parseArgs();

  await ensureServer();
  const fixture = await seedLandlordMobileBenchmarkFixture();
  await sendOtp(fixture.landlordPhoneNumber);
  const code = await resolveOtpCode(fixture.landlordPhoneNumber);
  const token = await verifyOtp(fixture.landlordPhoneNumber, code);
  const scenarios = buildScenarios(token, fixture.propertyId, quick);

  console.log("Landlord mobile analytics benchmark");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Property: ${fixture.propertyId}`);
  console.log(`Mode: ${quick ? "quick" : "default"}`);
  console.log("");

  const results: BenchResult[] = [];
  for (const scenario of scenarios) {
    console.log(`Running: ${scenario.title}`);
    const result = await runScenario(scenario, "amount");
    results.push(result);
    printResult(result);
  }

  printSummary(results);
}

await main();
