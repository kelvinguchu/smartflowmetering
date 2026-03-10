import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { meterApplications } from "../../src/db/schema";
import { ensureInfraReady, resetE2EState, teardownE2E } from "./helpers";

const app = createApp();

function validPayload() {
  return {
    firstName: "Jane",
    lastName: "Landlord",
    phoneNumber: "0712345678",
    email: "jane@example.com",
    idNumber: "12345678",
    kraPin: "A123456789Z",
    county: "Nairobi",
    location: "Westlands",
    buildingType: "residential",
    utilityType: "electricity",
    motherMeterNumber: "MM-APP-1001",
    initialReading: 0,
    paymentMode: "prepaid",
    subMeterNumbers: ["SM-1001", "SM-1002"],
    installationType: "new",
    suppliesOtherHouses: false,
    billPayer: "landlord",
    technicianName: "Tech One",
    technicianPhone: "0700000000",
    termsAccepted: true,
  };
}

describe("E2E: Meter application onboarding", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  it("accepts a public meter application and stores pending status", async () => {
    const response = await app.request("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload()),
    });

    const body = (await response.json()) as {
      data?: { id?: string; status?: string };
    };

    assert.equal(response.status, 201);
    assert.ok(body.data?.id);
    assert.equal(body.data?.status, "pending");

    const stored = await db.query.meterApplications.findFirst({
      where: eq(meterApplications.id, body.data!.id!),
      columns: { id: true, status: true, motherMeterNumber: true },
    });

    assert.ok(stored);
    assert.equal(stored.status, "pending");
    assert.equal(stored.motherMeterNumber, "MM-APP-1001");
  });

  it("rejects application when terms are not accepted", async () => {
    const response = await app.request("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload(), termsAccepted: false }),
    });

    assert.equal(response.status, 400);
  });

  it("protects admin onboarding endpoints from unauthenticated access", async () => {
    const listResponse = await app.request("/api/applications", {
      method: "GET",
    });
    assert.equal(listResponse.status, 401);

    const createResponse = await app.request("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload()),
    });
    const createBody = (await createResponse.json()) as {
      data?: { id?: string };
    };
    assert.equal(createResponse.status, 201);
    assert.ok(createBody.data?.id);

    const approveResponse = await app.request(
      `/api/applications/${createBody.data.id}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tariffId: crypto.randomUUID() }),
      }
    );
    assert.equal(approveResponse.status, 401);
  });
});
