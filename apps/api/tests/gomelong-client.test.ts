import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixturePath = path.join(
  apiRoot,
  "tests/fixtures/gomelong-client-fixture.ts",
);

describe("gomelong client", () => {
  it("injects credentials into query payloads through one helper", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", fixturePath],
      {
        cwd: apiRoot,
        env: { ...process.env },
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      MeterCode: "12345678",
      MeterType: 1,
      Password: "gomelong-test-secret",
      UserId: "gomelong-user",
    });
  });
});
