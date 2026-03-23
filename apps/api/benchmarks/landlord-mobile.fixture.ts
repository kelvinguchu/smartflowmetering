import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { customers, meters, motherMeterEvents, motherMeters, transactions, verification } from "../src/db/schema";
import type { NewMeter, NewMotherMeter } from "../src/db/schema";
import { ensureTestMeterFixture, resetE2EState, uniqueRef } from "../tests/e2e/helpers";

export interface LandlordMobileBenchmarkFixture {
  landlordPhoneNumber: string;
  propertyId: string;
}

export async function seedLandlordMobileBenchmarkFixture(): Promise<LandlordMobileBenchmarkFixture> {
  await resetE2EState();

  const base = await ensureTestMeterFixture("BENCH-LANDLORD-METER-001");
  const landlord = await db.query.customers.findFirst({
    where: eq(customers.id, base.customerId),
    columns: { phoneNumber: true },
  });
  if (!landlord) {
    throw new Error("Benchmark landlord fixture missing");
  }

  const [postpaidMotherMeter] = await db
    .insert(motherMeters)
    .values({
      landlordId: base.customerId,
      lowBalanceThreshold: "1000",
      motherMeterNumber: `MM-BENCH-${uniqueRef("POST")}`,
      propertyId: base.propertyId,
      tariffId: base.tariffId,
      type: "postpaid",
    } satisfies NewMotherMeter)
    .returning({ id: motherMeters.id });

  const [prepaidMotherMeter] = await db
    .insert(motherMeters)
    .values({
      landlordId: base.customerId,
      lowBalanceThreshold: "1000",
      motherMeterNumber: `MM-BENCH-${uniqueRef("PRE")}`,
      propertyId: base.propertyId,
      tariffId: base.tariffId,
      type: "prepaid",
    } satisfies NewMotherMeter)
    .returning({ id: motherMeters.id });

  const meterIds = [base.meterId];
  meterIds.push(...(await createMetersForMotherMeter(base.tariffId, base.motherMeterId, "BASE")));
  meterIds.push(...(await createMetersForMotherMeter(base.tariffId, postpaidMotherMeter.id, "POST")));
  meterIds.push(...(await createMetersForMotherMeter(base.tariffId, prepaidMotherMeter.id, "PRE")));

  await db.insert(motherMeterEvents).values(buildMotherMeterEvents([
    base.motherMeterId,
    postpaidMotherMeter.id,
    prepaidMotherMeter.id,
  ]));

  await db.insert(transactions).values(
    buildTransactions({
      meterIds,
      startDate: new Date("2026-02-01T08:00:00.000Z"),
      days: 45,
      transactionsPerMeterPerDay: 2,
    }),
  );

  return {
    landlordPhoneNumber: landlord.phoneNumber,
    propertyId: base.propertyId,
  };
}

export async function resolveOtpCode(phoneNumber: string): Promise<string> {
  const row = await db.query.verification.findFirst({
    where: eq(verification.identifier, phoneNumber),
    columns: { value: true },
  });
  if (!row) {
    throw new Error("OTP verification row not found");
  }

  const [code] = row.value.split(":");
  if (!code) {
    throw new Error("OTP code missing");
  }

  return code;
}

async function createMetersForMotherMeter(
  tariffId: string,
  motherMeterId: string,
  prefix: string,
) {
  const rows = await db
    .insert(meters)
    .values([
      {
        brand: "hexing",
        keyRevisionNumber: 1,
        meterNumber: `BENCH-${prefix}-${uniqueRef("M1")}`,
        meterType: "electricity",
        motherMeterId,
        status: "active",
        supplyGroupCode: "600675",
        tariffId,
        tariffIndex: 1,
      } satisfies NewMeter,
      {
        brand: "hexing",
        keyRevisionNumber: 1,
        meterNumber: `BENCH-${prefix}-${uniqueRef("M2")}`,
        meterType: "electricity",
        motherMeterId,
        status: "active",
        supplyGroupCode: "600675",
        tariffId,
        tariffIndex: 1,
      } satisfies NewMeter,
    ])
    .returning({ id: meters.id });

  return rows.map((row) => row.id);
}

function buildMotherMeterEvents(motherMeterIds: string[]) {
  return motherMeterIds.flatMap((motherMeterId, index) => [
    {
      amount: `${400 + index * 75}.00`,
      createdAt: new Date(`2026-02-${String(index + 1).padStart(2, "0")}T07:00:00.000Z`),
      eventType: "initial_deposit" as const,
      motherMeterId,
      performedBy: crypto.randomUUID(),
    },
    {
      amount: `${120 + index * 15}.00`,
      createdAt: new Date(`2026-02-${String(index + 8).padStart(2, "0")}T11:00:00.000Z`),
      eventType: "refill" as const,
      motherMeterId,
      performedBy: crypto.randomUUID(),
    },
    {
      amount: `${90 + index * 10}.00`,
      createdAt: new Date(`2026-02-${String(index + 15).padStart(2, "0")}T15:00:00.000Z`),
      eventType: "bill_payment" as const,
      motherMeterId,
      performedBy: crypto.randomUUID(),
    },
  ]);
}

function buildTransactions(input: {
  days: number;
  meterIds: string[];
  startDate: Date;
  transactionsPerMeterPerDay: number;
}) {
  const rows = [];
  let sequence = 0;

  for (let day = 0; day < input.days; day++) {
    for (const [meterIndex, meterId] of input.meterIds.entries()) {
      for (let tx = 0; tx < input.transactionsPerMeterPerDay; tx++) {
        const completedAt = new Date(input.startDate);
        completedAt.setUTCDate(completedAt.getUTCDate() + day);
        completedAt.setUTCHours(8 + tx, meterIndex * 3, 0, 0);

        const netAmount = 95 + meterIndex * 5 + tx * 7;
        const unitsPurchased = 3.5 + meterIndex * 0.25 + tx * 0.5;
        const reference = String(sequence).padStart(6, "0");
        sequence += 1;

        rows.push({
          amountPaid: (netAmount + 10).toFixed(2),
          commissionAmount: "10.00",
          completedAt,
          meterId,
          mpesaReceiptNumber: `BENCH-MPESA-${reference}`,
          netAmount: netAmount.toFixed(2),
          paymentMethod: tx % 2 === 0 ? ("paybill" as const) : ("stk_push" as const),
          phoneNumber: `2547${String(10000000 + day * 17 + meterIndex * 13 + tx).slice(-8)}`,
          rateUsed: "24.0000",
          status: "completed" as const,
          transactionId: `BENCH-OHM-${reference}`,
          unitsPurchased: unitsPurchased.toFixed(4),
        });
      }
    }
  }

  return rows;
}
