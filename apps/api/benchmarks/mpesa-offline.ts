process.env.NODE_ENV ??= "test";

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { db } from "../src/db";
import { smsLogs, transactions } from "../src/db/schema";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
  waitFor,
} from "../tests/e2e/helpers";

type Measurement = {
  run: number;
  ackMs: number;
  completedMs: number;
  smsState: "sent" | "failed" | "missing";
  smsStateMs: number | null;
};

type CallbackPayload = {
  TransactionType: string;
  TransTime: string;
  BusinessShortCode: string;
  BillRefNumber: string;
  MSISDN: string;
  FirstName: string;
  MiddleName: string;
  LastName: string;
  TransID: string;
  TransAmount: number;
};

const app = createApp();

function parseRuns(): number {
  const rawValue = process.argv[2];
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : 3;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function printSummary(results: Measurement[]) {
  const completed = results.map((result) => result.completedMs);
  const smsFinished = results.filter((result) => result.smsStateMs !== null);
  const smsTimes = smsFinished
    .map((result) => result.smsStateMs)
    .filter((value): value is number => value !== null);

  console.log("\nSummary");
  console.log(
    `Average callback ACK: ${average(results.map((result) => result.ackMs)).toFixed(1)}ms`,
  );
  console.log(
    `Average transaction completed: ${average(completed).toFixed(1)}ms`,
  );

  if (smsTimes.length > 0) {
    console.log(
      `Average SMS terminal state: ${average(smsTimes).toFixed(1)}ms`,
    );
  }

  console.log(
    `SMS states: ${results.map((result) => result.smsState).join(", ")}`,
  );
}

async function postJson(path: string, payload: CallbackPayload) {
  const response = await app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "196.201.214.200",
    },
    body: JSON.stringify(payload),
  });

  return {
    response,
    body: (await response.json()) as Record<string, unknown>,
  };
}

async function waitForTransactionCompletion(
  transId: string,
  startedAt: number,
) {
  let completedMs = 0;

  await waitFor(
    async () => {
      const transaction = await db.query.transactions.findFirst({
        where: eq(transactions.mpesaReceiptNumber, transId),
        columns: { status: true },
      });

      if (transaction?.status === "completed") {
        completedMs = performance.now() - startedAt;
        return true;
      }

      return false;
    },
    15_000,
    25,
  );

  return completedMs;
}

async function waitForSmsTerminalState(transId: string, startedAt: number) {
  let smsState: Measurement["smsState"] = "missing";
  let smsStateMs: number | null = null;

  try {
    await waitFor(
      async () => {
        const transaction = await db.query.transactions.findFirst({
          where: eq(transactions.mpesaReceiptNumber, transId),
          columns: { id: true },
        });

        if (!transaction) {
          return false;
        }

        const smsLog = await db.query.smsLogs.findFirst({
          where: eq(smsLogs.transactionId, transaction.id),
          columns: { status: true },
        });

        if (!smsLog) {
          return false;
        }

        if (smsLog.status === "sent" || smsLog.status === "failed") {
          smsState = smsLog.status;
          smsStateMs = performance.now() - startedAt;
          return true;
        }

        return false;
      },
      15_000,
      25,
    );
  } catch {
    return { smsState, smsStateMs };
  }

  return { smsState, smsStateMs };
}

async function runOnce(run: number): Promise<Measurement> {
  await resetE2EState();
  await ensureTestMeterFixture("TEST-METER-001");

  const transId = uniqueRef("OFFLINE");
  const payload: CallbackPayload = {
    TransactionType: "Pay Bill",
    TransTime: "20260307120000",
    BusinessShortCode: "174379",
    BillRefNumber: "TEST-METER-001",
    MSISDN: "254712345678",
    FirstName: "Offline",
    MiddleName: "Mpesa",
    LastName: "Bench",
    TransID: transId,
    TransAmount: 100,
  };

  const validation = await postJson("/api/mpesa/validation", payload);
  assert.equal(validation.response.status, 200);
  assert.equal(validation.body.ResultCode, "0");

  const startedAt = performance.now();
  const callback = await postJson("/api/mpesa/callback", payload);
  const ackMs = performance.now() - startedAt;

  assert.equal(callback.response.status, 200);
  assert.equal(callback.body.ResultCode, "0");

  const completedMs = await waitForTransactionCompletion(transId, startedAt);
  const { smsState, smsStateMs } = await waitForSmsTerminalState(
    transId,
    startedAt,
  );

  return {
    run,
    ackMs,
    completedMs,
    smsState,
    smsStateMs,
  };
}

async function main() {
  const runs = parseRuns();
  const results: Measurement[] = [];

  await ensureInfraReady();

  try {
    console.log(`Running offline M-Pesa latency benchmark (${runs} runs)\n`);

    for (let run = 1; run <= runs; run++) {
      const result = await runOnce(run);
      results.push(result);
      const smsTiming =
        result.smsStateMs === null
          ? ""
          : ` @ ${result.smsStateMs.toFixed(1)}ms`;
      console.log(
        `Run ${result.run}: ack ${result.ackMs.toFixed(1)}ms | completed ${result.completedMs.toFixed(1)}ms | sms ${result.smsState}${smsTiming}`,
      );
    }

    printSummary(results);
  } finally {
    await teardownE2E();
  }
}

await main();
