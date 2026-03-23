import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  teardownE2E,
  uniqueRef,
} from "./helpers";

const app = createApp();
const MANAGED_USER_PASSWORD = ["Pass", "w0rd", "!"].join("");

void describe("E2E: audit logs", () => {
  before(async () => {
    await ensureInfraReady();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("keeps audit logs restricted to admins", async () => {
    const userSession = await createAuthenticatedSession(app, "user");
    const response = await app.request("/api/audit-logs", {
      method: "GET",
      headers: userSession.headers,
    });

    assert.equal(response.status, 403);

    const detailResponse = await app.request(
      "/api/audit-logs/00000000-0000-0000-0000-000000000000",
      {
        method: "GET",
        headers: userSession.headers,
      },
    );

    assert.equal(detailResponse.status, 403);
  });

  void it("lets admins filter and read audit logs for user-management actions", async () => {
    const adminSession = await createAuthenticatedSession(app, "admin");
    const createResponse = await app.request("/api/users", {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify({
        email: `${uniqueRef("audit")}@gmail.com`,
        name: "Audit Target",
        password: MANAGED_USER_PASSWORD,
        phoneNumber: "254712345678",
        role: "user",
      }),
    });
    assert.equal(createResponse.status, 201);

    const createdBody = (await createResponse.json()) as {
      data: { id: string };
    };

    const roleResponse = await app.request(
      `/api/users/${createdBody.data.id}/role`,
      {
        method: "POST",
        headers: adminSession.headers,
        body: JSON.stringify({ role: "admin" }),
      },
    );
    assert.equal(roleResponse.status, 200);

    const listResponse = await app.request(
      `/api/audit-logs?action=user_management.set-role&entityType=user&entityId=${createdBody.data.id}`,
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(listResponse.status, 200);

    const listBody = (await listResponse.json()) as {
      data: {
        action: string;
        actor: { email: string; id: string; name: string } | null;
        details: Record<string, string> | null;
        entityId: string;
        id: string;
      }[];
      pagination: { total: number };
    };
    assert.equal(listBody.pagination.total, 1);
    assert.equal(listBody.data[0].action, "user_management.set-role");
    assert.equal(listBody.data[0].entityId, createdBody.data.id);
    assert.ok(listBody.data[0].actor);
    assert.equal(listBody.data[0].details?.role, "admin");

    const detailResponse = await app.request(
      `/api/audit-logs/${listBody.data[0].id}`,
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(detailResponse.status, 200);

    const detailBody = (await detailResponse.json()) as {
      data: {
        action: string;
        actor: { email: string; id: string; name: string } | null;
        entityId: string;
        id: string;
      };
    };
    assert.equal(detailBody.data.id, listBody.data[0].id);
    assert.equal(detailBody.data.action, "user_management.set-role");
    assert.equal(detailBody.data.entityId, createdBody.data.id);
    assert.ok(detailBody.data.actor);
  });
});
