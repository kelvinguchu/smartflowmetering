/**
 * Benchmark runner — executes scenarios sequentially and prints a summary table.
 *
 * Usage:
 *   # Public endpoints only (no auth required)
 *   npx tsx benchmarks/run.ts
 *
 *   # Include authenticated endpoints (pass session cookie)
 *   npx tsx benchmarks/run.ts --cookie "better-auth.session_token=abc123..."
 *
 *   # Custom target URL
 *   BENCH_URL=http://staging:3000 npx tsx benchmarks/run.ts
 *
 *   # Quick mode (5s, 5 connections) — useful for CI
 *   npx tsx benchmarks/run.ts --quick
 */
import {
  BASE_URL,
  DEFAULTS,
  runScenario,
  printResult,
  type BenchResult,
} from "./config";
import { publicScenarios, authenticatedScenarios } from "./scenarios";

function parseArgs() {
  const args = process.argv.slice(2);
  let cookie: string | undefined;
  let quick = false;
  let unsafe = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cookie" && args[i + 1]) {
      cookie = args[i + 1];
      i++;
    }
    if (args[i] === "--quick") {
      quick = true;
    }
    if (args[i] === "--unsafe") {
      unsafe = true;
    }
  }
  return { cookie, quick, unsafe };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RunnerOptions = {
  amount?: number;
  duration?: number;
  connections: number;
};

function buildRunnerOptions(quick: boolean, unsafe: boolean): RunnerOptions {
  if (unsafe) {
    if (quick) {
      return { duration: 5, connections: 5 };
    }

    return { duration: DEFAULTS.duration, connections: 10 };
  }

  if (quick) {
    return { amount: 10, connections: 1 };
  }

  return { amount: DEFAULTS.amount, connections: DEFAULTS.connections };
}

function applyOverrides(
  scenarios: Array<(typeof publicScenarios)[number]>,
  overrides: RunnerOptions,
) {
  for (const scenario of scenarios) {
    if (overrides.amount) {
      scenario.amount = overrides.amount;
    }

    if (overrides.duration) {
      scenario.duration = overrides.duration;
    }

    scenario.connections = overrides.connections;
  }
}

function printHeader(
  mode: "amount" | "duration",
  overrides: RunnerOptions,
  scenarioCount: number,
  hasAuth: boolean,
) {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║    Smart Flow Metering API Benchmark         ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`  Target:      ${BASE_URL}`);
  console.log(`  Mode:        ${mode}`);
  console.log(
    mode === "amount"
      ? `  Requests:    ${overrides.amount ?? DEFAULTS.amount} per scenario`
      : `  Duration:    ${overrides.duration ?? DEFAULTS.duration}s per scenario`,
  );
  console.log(`  Connections: ${overrides.connections}`);
  console.log(`  Scenarios:   ${scenarioCount}`);
  console.log(
    `  Auth:        ${hasAuth ? "yes (session cookie)" : "no (public only)"}`,
  );
  console.log("");

  if (mode === "amount") {
    console.log("ℹ  Safe mode stays under the shared 100 req/60s IP limit.\n");
    return;
  }

  console.log("⚠  Unsafe mode can hit the shared 100 req/60s IP limit.");
  console.log(
    "   For raw throughput testing, temporarily increase the limit.\n",
  );
}

function printSummary(results: BenchResult[]) {
  console.log(
    "\n\n═══ Summary ═══════════════════════════════════════════════════",
  );
  console.log(
    "Scenario".padEnd(40) +
      "Req/s".padStart(8) +
      "Avg(ms)".padStart(9) +
      "p99(ms)".padStart(9) +
      "Errors".padStart(8),
  );
  console.log("─".repeat(74));

  for (const result of results) {
    const errCount = result.errors + result.timeouts + result.non2xx;
    console.log(
      result.title.padEnd(40) +
        result.requests.average.toFixed(1).padStart(8) +
        result.latency.avg.toFixed(1).padStart(9) +
        String(result.latency.p99).padStart(9) +
        String(errCount).padStart(8),
    );
  }

  console.log("═".repeat(74));
}

async function main() {
  const { cookie, quick, unsafe } = parseArgs();

  const mode = unsafe ? "duration" : "amount";
  const overrides = buildRunnerOptions(quick, unsafe);
  const scenarios = [...publicScenarios];

  if (cookie) {
    scenarios.push(...authenticatedScenarios(cookie));
  }

  applyOverrides(scenarios, overrides);
  printHeader(mode, overrides, scenarios.length, Boolean(cookie));

  // Verify server is reachable
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch {
    console.error(
      `✗ Cannot reach ${BASE_URL}/api/health — is the server running?`,
    );
    process.exit(1);
  }

  const results: BenchResult[] = [];

  for (const scenario of scenarios) {
    console.log(`▶ Running: ${scenario.title}...`);
    const result = await runScenario(scenario, mode);
    results.push(result);
    printResult(result);

    if (mode === "amount") {
      await sleep(250);
    }
  }

  printSummary(results);
}

try {
  await main();
} catch (err) {
  console.error("Benchmark failed:", err);
  process.exit(1);
}
