import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRedisUrl } from "../src/lib/redis-url";

describe("parseRedisUrl", () => {
  it("preserves host credentials and database index", () => {
    const credential = "secret";

    assert.deepEqual(
      parseRedisUrl(`redis://user:${credential}@localhost:6380/2`),
      {
        db: 2,
        host: "localhost",
        password: credential,
        port: 6380,
        tls: undefined,
        username: "user",
      },
    );
  });

  it("enables TLS for rediss URLs", () => {
    assert.deepEqual(parseRedisUrl("rediss://cache.example.com:6380/1"), {
      db: 1,
      host: "cache.example.com",
      password: undefined,
      port: 6380,
      tls: {},
      username: undefined,
    });
  });

  it("rejects invalid database indexes", () => {
    assert.throws(
      () => parseRedisUrl("redis://localhost:6379/not-a-db"),
      /Invalid Redis database index in REDIS_URL/,
    );
  });
});
