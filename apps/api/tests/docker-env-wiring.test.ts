import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(apiRoot, "..", "..");

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("docker env wiring behavior", () => {
  it("uses DATABASE_URL and REDIS_URL from .env for the api service", () => {
    const compose = readRepoFile("docker-compose.yml");

    assert.match(compose, /DATABASE_URL:\s*\$\{DATABASE_URL(?::-[^}]*)?\}/);
    assert.match(compose, /REDIS_URL:\s*\$\{REDIS_URL(?::-[^}]*)?\}/);
  });

  it("keeps postgres and redis service auth in env-driven mode", () => {
    const compose = readRepoFile("docker-compose.yml");

    assert.match(compose, /POSTGRES_USER:\s*\$\{POSTGRES_USER:-postgres\}/);
    assert.match(compose, /redis-server --appendonly yes --requirepass \$\{REDIS_PASSWORD\}/);
    assert.match(compose, /redis-cli -a \$\{REDIS_PASSWORD\} ping/);
  });

  it("keeps dokploy compose aligned with the same db and redis env variables", () => {
    const dokployCompose = readRepoFile("docker-compose.dokploy.yml");

    assert.match(dokployCompose, /DATABASE_URL:\s*\$\{DATABASE_URL(?::-[^}]*)?\}/);
    assert.match(dokployCompose, /REDIS_URL:\s*\$\{REDIS_URL(?::-[^}]*)?\}/);
    assert.match(
      dokployCompose,
      /redis-server --appendonly yes --requirepass \$\{REDIS_PASSWORD\}/
    );
  });

  it("defines docker-reachable DB and Redis URLs in root .env", () => {
    const rootEnv = readRepoFile(".env");

    assert.match(
      rootEnv,
      /^DATABASE_URL=postgresql:\/\/\$\{POSTGRES_USER\}:\$\{POSTGRES_PASSWORD\}@postgres:5432\/\$\{POSTGRES_DB\}$/m
    );
    assert.match(
      rootEnv,
      /^REDIS_URL=redis:\/\/:\$\{REDIS_PASSWORD\}@redis:6379$/m
    );
  });
});
