import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import assert from "node:assert/strict";
import type { App } from "../../src/app";
import { env } from "../../src/config";
import { closeDbConnection, db } from "../../src/db";
import {
  account,
  customers,
  meters,
  motherMeters,
  properties,
  tariffs,
  user,
} from "../../src/db/schema";
import type {
  NewCustomer,
  NewMeter,
  NewMotherMeter,
  NewProperty,
  NewTariff,
} from "../../src/db/schema";
import {
  appNotificationDeliveryQueue,
  closeAllQueues,
  paymentProcessingQueue,
  smsDeliveryQueue,
  startQueueWorkers,
  tokenGenerationQueue,
} from "../../src/queues";

const TRUNCATE_SQL = `
TRUNCATE TABLE
  sms_logs,
  customer_app_notifications,
  customer_device_tokens,
  tenant_app_accesses,
  admin_notifications,
  audit_logs,
  meter_applications,
  generated_tokens,
  failed_transactions,
  transactions,
  mpesa_transactions,
  mother_meter_events,
  meters,
  mother_meters,
  properties,
  customers,
  tariffs,
  session,
  account,
  two_factor,
  verification,
  "user"
CASCADE;
`;

export async function ensureInfraReady() {
  try {
    applyE2EEnvOverrides();
    await startQueueWorkers();
    await db.execute(sql`SELECT 1`);
    await paymentProcessingQueue.getJobCounts("waiting");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown infrastructure error";
    throw new Error(
      `E2E infrastructure unavailable. Start docker first, then run tests. Cause: ${message}`,
    );
  }
}

function applyE2EEnvOverrides() {
  process.env.NODE_ENV = "test";
  process.env.MPESA_REQUIRE_SIGNATURE = "false";

  Object.assign(env as MutableE2EEnv, {
    MPESA_REQUIRE_SIGNATURE: false,
    NODE_ENV: "test",
  });
}

type MutableE2EEnv = {
  MPESA_REQUIRE_SIGNATURE: boolean;
  NODE_ENV: "development" | "production" | "test";
};

type CleanupQueue = Pick<typeof paymentProcessingQueue, "clean" | "drain">;

async function clearQueue(queue: CleanupQueue) {
  await queue.drain();
  await queue.clean(0, 10_000, "completed");
  await queue.clean(0, 10_000, "failed");
  await queue.clean(0, 10_000, "delayed");
  await queue.clean(0, 10_000, "wait");
  await queue.clean(0, 10_000, "active");
  await queue.clean(0, 10_000, "paused");
}

export async function resetE2EState() {
  await clearQueue(appNotificationDeliveryQueue);
  await clearQueue(paymentProcessingQueue);
  await clearQueue(tokenGenerationQueue);
  await clearQueue(smsDeliveryQueue);
  await db.execute(sql.raw(TRUNCATE_SQL));
}

export async function teardownE2E() {
  await closeAllQueues();
  await closeDbConnection();
}

interface TestMeterFixture {
  tariffId: string;
  customerId: string;
  propertyId: string;
  motherMeterId: string;
  motherMeterNumber: string;
  meterId: string;
  meterNumber: string;
}

export async function ensureTestMeterFixture(
  meterNumber = "TEST-METER-001",
): Promise<TestMeterFixture> {
  const existingMeter = await db.query.meters.findFirst({
    where: eq(meters.meterNumber, meterNumber),
    columns: {
      id: true,
      tariffId: true,
      motherMeterId: true,
      meterNumber: true,
    },
  });

  if (existingMeter) {
    const mother = await db.query.motherMeters.findFirst({
      where: eq(motherMeters.id, existingMeter.motherMeterId),
      columns: {
        id: true,
        landlordId: true,
        motherMeterNumber: true,
        propertyId: true,
      },
    });

    assert.ok(mother, "Expected mother meter for existing test meter");

    return {
      tariffId: existingMeter.tariffId,
      customerId: mother.landlordId,
      propertyId: mother.propertyId,
      motherMeterId: mother.id,
      motherMeterNumber: mother.motherMeterNumber,
      meterId: existingMeter.id,
      meterNumber: existingMeter.meterNumber,
    };
  }

  const [tariff] = await db
    .insert(tariffs)
    .values({
      name: "Test Tariff",
      ratePerKwh: "25.0000",
      currency: "KES",
    } satisfies NewTariff)
    .returning({ id: tariffs.id });

  const [customer] = await db
    .insert(customers)
    .values({
      userId: crypto.randomUUID(),
      name: "Test Landlord",
      phoneNumber: `2547${Math.floor(10000000 + Math.random() * 89999999)}`,
      customerType: "landlord",
    } satisfies NewCustomer)
    .returning({ id: customers.id });

  const [property] = await db
    .insert(properties)
    .values({
      name: "Test Property",
      location: "Nairobi, Kenya",
      numberOfUnits: 10,
      landlordId: customer.id,
    } satisfies NewProperty)
    .returning({ id: properties.id });

  const [motherMeter] = await db
    .insert(motherMeters)
    .values({
      motherMeterNumber: `MM-TEST-${Math.floor(100000 + Math.random() * 899999)}`,
      type: "prepaid",
      landlordId: customer.id,
      tariffId: tariff.id,
      propertyId: property.id,
      totalCapacity: "100.00",
      lowBalanceThreshold: "1000",
    } satisfies NewMotherMeter)
    .returning({
      id: motherMeters.id,
      motherMeterNumber: motherMeters.motherMeterNumber,
    });

  const [meter] = await db
    .insert(meters)
    .values({
      meterNumber,
      meterType: "electricity",
      brand: "hexing",
      motherMeterId: motherMeter.id,
      tariffId: tariff.id,
      supplyGroupCode: "600675",
      keyRevisionNumber: 1,
      tariffIndex: 1,
      status: "active",
    } satisfies NewMeter)
    .returning({ id: meters.id, meterNumber: meters.meterNumber });

  return {
    tariffId: tariff.id,
    customerId: customer.id,
    propertyId: property.id,
    motherMeterId: motherMeter.id,
    motherMeterNumber: motherMeter.motherMeterNumber,
    meterId: meter.id,
    meterNumber: meter.meterNumber,
  };
}

export function uniqueRef(prefix: string) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 10_000)}`;
}

export function uniqueKenyanPhoneNumber(): string {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
  return `2547${suffix.slice(-8)}`;
}

export async function waitFor(
  check: () => Promise<boolean>,
  timeoutMs = 15_000,
  intervalMs = 200,
) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  assert.fail(`Condition not met within ${timeoutMs}ms`);
}

export async function createAuthenticatedSession(
  app: App,
  role: "admin" | "user" = "admin",
) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
  const email = `e2e-${role}-${suffix}@gmail.com`;
  const password = "Passw0rd!";
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await db.insert(user).values({
    id: userId,
    name: `E2E ${role}`,
    email,
    emailVerified: true,
    phoneNumber: `2547${suffix.slice(-8)}`,
    phoneNumberVerified: true,
    role,
  });

  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });

  const signInResponse = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  assert.equal(
    signInResponse.status,
    200,
    `Expected sign-in to succeed, got ${signInResponse.status}`,
  );

  const setCookie = signInResponse.headers.get("set-cookie");
  assert.ok(setCookie, "Expected sign-in response to set a session cookie");

  const sessionTokenCookie =
    /better-auth\.session_token=[^;]+/.exec(setCookie)?.[0] ?? "";
  const sessionDataCookie =
    /better-auth\.session_data=[^;]+/.exec(setCookie)?.[0] ?? "";
  const cookie = [sessionTokenCookie, sessionDataCookie]
    .filter(Boolean)
    .join("; ");

  assert.ok(cookie, "Expected valid auth cookie to be extracted");

  return {
    email,
    password,
    headers: {
      cookie,
      "Content-Type": "application/json",
    },
  };
}
