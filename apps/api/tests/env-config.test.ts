import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFixture = path.join(apiRoot, "tests/fixtures/load-env-module.ts");

function runEnvValidation(overrides: Record<string, string | undefined>) {
  const childEnv = { ...process.env };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete childEnv[key];
      continue;
    }
    childEnv[key] = value;
  }

  return spawnSync(process.execPath, ["--import", "tsx", envFixture], {
    cwd: apiRoot,
    env: childEnv,
    encoding: "utf8",
  });
}

describe("env validation behavior", () => {
  it("fails when DATABASE_URL is missing", () => {
    const result = runEnvValidation({
      NODE_ENV: "development",
      DATABASE_URL: undefined,
      REDIS_URL: "redis://localhost:6379",
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing required environment variable: DATABASE_URL/);
  });

  it("fails when REDIS_URL is missing", () => {
    const result = runEnvValidation({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/smartflowmetering",
      REDIS_URL: undefined,
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing required environment variable: REDIS_URL/);
  });

  it("fails in production when critical secrets are absent", () => {
    const result = runEnvValidation({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/smartflowmetering",
      REDIS_URL: "redis://localhost:6379",
      BETTER_AUTH_SECRET: undefined,
      MPESA_CONSUMER_KEY: undefined,
      MPESA_CONSUMER_SECRET: undefined,
      MPESA_PASSKEY: undefined,
      MPESA_SHORTCODE: undefined,
    });

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Missing required environment variables for production:/
    );
    assert.match(result.stderr, /BETTER_AUTH_SECRET/);
    assert.match(result.stderr, /MPESA_CONSUMER_KEY/);
  });

  it("passes with required variables in development mode", () => {
    const result = runEnvValidation({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/smartflowmetering",
      REDIS_URL: "redis://localhost:6379",
    });

    assert.equal(result.status, 0);
  });
});
