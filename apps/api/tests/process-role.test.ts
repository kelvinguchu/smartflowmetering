import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveProcessRole,
  shouldStartApiServer,
  shouldStartBackgroundServices,
} from "../src/runtime/process-role";

describe("process role helpers", () => {
  it("defaults invalid roles to all", () => {
    assert.equal(resolveProcessRole(undefined), "all");
    assert.equal(resolveProcessRole("invalid"), "all");
  });

  it("maps api and worker responsibilities correctly", () => {
    assert.equal(shouldStartApiServer("api"), true);
    assert.equal(shouldStartBackgroundServices("api"), false);
    assert.equal(shouldStartApiServer("worker"), false);
    assert.equal(shouldStartBackgroundServices("worker"), true);
    assert.equal(shouldStartApiServer("all"), true);
    assert.equal(shouldStartBackgroundServices("all"), true);
  });
});
