/**
 * Benchmark configuration and shared utilities.
 *
 * Usage: Imported by the runner and scenario files.
 * Default target: http://localhost:3000 (override via BENCH_URL env var)
 */
import autocannon from "autocannon";

export const BASE_URL = process.env.BENCH_URL ?? "http://localhost:3000";

/** Default benchmark options for safe benchmarking under the app's rate limit */
export const DEFAULTS = {
  amount: 20,
  duration: 10,
  connections: 1,
  pipelining: 1,
} as const;

export type Scenario = {
  title: string;
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  amount?: number;
  /** Override default connections/duration */
  connections?: number;
  duration?: number;
  /** Skip rate-limit-aware mode (e.g. for health endpoints) */
  skipRateLimitNote?: boolean;
};

export type BenchResult = {
  title: string;
  url: string;
  mode: "amount" | "duration";
  requests: { average: number; total: number; p99_latency: number };
  latency: { avg: number; p50: number; p99: number; max: number };
  throughput: { average: number };
  errors: number;
  timeouts: number;
  non2xx: number;
};

export async function runScenario(
  scenario: Scenario,
  mode: "amount" | "duration",
): Promise<BenchResult> {
  const url = `${BASE_URL}${scenario.path}`;
  const result = await autocannon({
    url,
    method: scenario.method ?? "GET",
    headers: scenario.headers,
    body: scenario.body,
    connections: scenario.connections ?? DEFAULTS.connections,
    pipelining: DEFAULTS.pipelining,
    ...(mode === "amount"
      ? { amount: scenario.amount ?? DEFAULTS.amount }
      : { duration: scenario.duration ?? DEFAULTS.duration }),
  });

  return {
    title: scenario.title,
    url,
    mode,
    requests: {
      average: result.requests.average,
      total: result.requests.total,
      p99_latency: result.latency.p99,
    },
    latency: {
      avg: result.latency.average,
      p50: result.latency.p50,
      p99: result.latency.p99,
      max: result.latency.max,
    },
    throughput: { average: result.throughput.average },
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
  };
}

export function printResult(r: BenchResult) {
  console.log(`\n── ${r.title} ──`);
  console.log(`   URL:        ${r.url}`);
  console.log(
    `   Req/s:      ${r.requests.average.toFixed(1)}  (total: ${r.requests.total})`,
  );
  console.log(
    `   Latency:    avg ${r.latency.avg.toFixed(2)}ms | p50 ${r.latency.p50}ms | p99 ${r.latency.p99}ms | max ${r.latency.max}ms`,
  );
  console.log(
    `   Throughput: ${(r.throughput.average / 1024).toFixed(1)} KB/s`,
  );
  if (r.errors > 0 || r.timeouts > 0 || r.non2xx > 0) {
    console.log(
      `   ⚠ Errors: ${r.errors}  Timeouts: ${r.timeouts}  Non-2xx: ${r.non2xx}`,
    );
  }
}
