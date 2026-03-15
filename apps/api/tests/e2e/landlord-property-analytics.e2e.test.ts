import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { customers } from "../../src/db/schema";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
} from "./helpers";
import {
  loginAsLandlord,
  seedLandlordPropertyAnalyticsFixture,
} from "./landlord-property-analytics.fixture";

const app = createApp();

void describe("E2E: landlord property analytics", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns property rollups and mother meter comparisons", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-PROP-ANALYTICS-001");
    const landlord = await db.query.customers.findFirst({
      where: eq(customers.id, fixture.customerId),
    });
    assert.ok(landlord);

    const seeded = await seedLandlordPropertyAnalyticsFixture({
      customerId: fixture.customerId,
      fixtureMeterId: fixture.meterId,
      fixtureMotherMeterId: fixture.motherMeterId,
      propertyId: fixture.propertyId,
      tariffId: fixture.tariffId,
    });
    const token = await loginAsLandlord(app, landlord.phoneNumber);

    const summaryResponse = await app.request(
      `/api/mobile/landlord-access/properties/${fixture.propertyId}/analytics-summary`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(summaryResponse.status, 200);
    const summaryBody = (await summaryResponse.json()) as {
      data: {
        breakdown: {
          postpaid: { tenantPurchasesNetAmount: string };
          prepaid: { tenantPurchasesNetAmount: string };
        };
        motherMeterCounts: { postpaid: number; prepaid: number; total: number };
        motherMeterType: string | null;
        totals: { tenantPurchasesNetAmount: string };
      };
    };
    assert.equal(summaryBody.data.motherMeterCounts.total, 2);
    assert.equal(summaryBody.data.motherMeterCounts.prepaid, 1);
    assert.equal(summaryBody.data.motherMeterCounts.postpaid, 1);
    assert.equal(summaryBody.data.motherMeterType, null);
    assert.equal(summaryBody.data.totals.tenantPurchasesNetAmount, "220.00");
    assert.equal(summaryBody.data.breakdown.prepaid.tenantPurchasesNetAmount, "130.00");
    assert.equal(summaryBody.data.breakdown.postpaid.tenantPurchasesNetAmount, "90.00");

    const filteredSummaryResponse = await app.request(
      `/api/mobile/landlord-access/properties/${fixture.propertyId}/analytics-summary?motherMeterType=postpaid`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(filteredSummaryResponse.status, 200);
    const filteredSummaryBody = (await filteredSummaryResponse.json()) as {
      data: {
        breakdown: {
          postpaid: { tenantPurchasesNetAmount: string };
          prepaid: { tenantPurchasesNetAmount: string };
        };
        motherMeterCounts: { postpaid: number; prepaid: number; total: number };
        motherMeterType: string | null;
        totals: { tenantPurchasesNetAmount: string };
      };
    };
    assert.equal(filteredSummaryBody.data.motherMeterType, "postpaid");
    assert.equal(filteredSummaryBody.data.motherMeterCounts.total, 1);
    assert.equal(filteredSummaryBody.data.motherMeterCounts.postpaid, 1);
    assert.equal(filteredSummaryBody.data.motherMeterCounts.prepaid, 0);
    assert.equal(filteredSummaryBody.data.totals.tenantPurchasesNetAmount, "90.00");
    assert.equal(
      filteredSummaryBody.data.breakdown.postpaid.tenantPurchasesNetAmount,
      "90.00",
    );
    assert.equal(
      filteredSummaryBody.data.breakdown.prepaid.tenantPurchasesNetAmount,
      "0.00",
    );

    const rollupResponse = await app.request(
      `/api/mobile/landlord-access/properties/${fixture.propertyId}/rollups?granularity=day`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(rollupResponse.status, 200);
    const rollupBody = (await rollupResponse.json()) as {
      count: number;
      data: {
        bucket: string;
        bucketMeta: { endDate: string; key: string; startDate: string };
        breakdown: {
          postpaid: { tenantPurchasesNetAmount: string };
          prepaid: { tenantPurchasesNetAmount: string };
        };
        granularity: string;
        motherMeterType: string | null;
        totals: { motherMetersWithPurchases: number; tenantPurchasesNetAmount: string };
      }[];
      pagination: {
        hasMore: boolean;
        limit: number | null;
        nextOffset: number | null;
        offset: number;
      };
    };
    assert.equal(rollupBody.count, 3);
    assert.equal(rollupBody.pagination.limit, null);
    assert.equal(rollupBody.pagination.offset, 0);
    assert.equal(rollupBody.pagination.hasMore, false);
    assert.equal(rollupBody.pagination.nextOffset, null);
    assert.equal(rollupBody.data[0]?.bucket, "2026-03-13");
    assert.equal(rollupBody.data[0]?.bucketMeta.key, "2026-03-13");
    assert.equal(rollupBody.data[0]?.bucketMeta.startDate, "2026-03-13");
    assert.equal(rollupBody.data[0]?.bucketMeta.endDate, "2026-03-13");
    assert.equal(rollupBody.data[0]?.granularity, "day");
    assert.equal(rollupBody.data[0]?.motherMeterType, null);
    assert.equal(rollupBody.data[0]?.totals.tenantPurchasesNetAmount, "90.00");
    assert.equal(
      rollupBody.data[0]?.breakdown.postpaid.tenantPurchasesNetAmount,
      "90.00",
    );
    assert.equal(rollupBody.data[1]?.totals.motherMetersWithPurchases, 1);

    const filteredRollupResponse = await app.request(
      `/api/mobile/landlord-access/properties/${fixture.propertyId}/rollups?granularity=day&motherMeterType=prepaid`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(filteredRollupResponse.status, 200);
    const filteredRollupBody = (await filteredRollupResponse.json()) as {
      count: number;
      data: {
        motherMeterType: string | null;
        totals: { tenantPurchasesNetAmount: string };
      }[];
    };
    assert.equal(filteredRollupBody.count, 2);
    assert.equal(filteredRollupBody.data[0]?.motherMeterType, "prepaid");
    assert.equal(filteredRollupBody.data[0]?.totals.tenantPurchasesNetAmount, "130.00");

    const monthlyRollupResponse = await app.request(
      `/api/mobile/landlord-access/properties/${fixture.propertyId}/rollups?granularity=month`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(monthlyRollupResponse.status, 200);
    const monthlyRollupBody = (await monthlyRollupResponse.json()) as {
      count: number;
      data: {
        bucket: string;
        bucketMeta: { endDate: string; key: string; startDate: string };
        totals: { tenantPurchasesNetAmount: string };
      }[];
    };
    assert.equal(monthlyRollupBody.count, 1);
    assert.equal(monthlyRollupBody.data[0]?.bucket, "2026-03");
    assert.equal(monthlyRollupBody.data[0]?.bucketMeta.startDate, "2026-03-01");
    assert.equal(monthlyRollupBody.data[0]?.bucketMeta.endDate, "2026-03-31");
    assert.equal(monthlyRollupBody.data[0]?.totals.tenantPurchasesNetAmount, "220.00");

    const comparisonResponse = await app.request(
      `/api/mobile/landlord-access/properties/${fixture.propertyId}/mother-meter-comparisons`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(comparisonResponse.status, 200);
    const comparisonBody = (await comparisonResponse.json()) as {
      count: number;
      data: {
        financialSnapshot: { postpaidOutstandingAmount: string | null; prepaidEstimatedBalance: string | null };
        motherMeter: { id: string; type: "postpaid" | "prepaid" };
        motherMeterType: string | null;
        totals: { tenantPurchasesNetAmount: string };
      }[];
      pagination: {
        hasMore: boolean;
        limit: number | null;
        nextOffset: number | null;
        offset: number;
      };
    };
    assert.equal(comparisonBody.count, 2);
    assert.equal(comparisonBody.pagination.limit, null);
    assert.equal(comparisonBody.pagination.offset, 0);
    assert.equal(comparisonBody.pagination.hasMore, false);
    assert.equal(comparisonBody.pagination.nextOffset, null);
    const prepaidComparison = comparisonBody.data.find(
      (item) => item.motherMeter.id === fixture.motherMeterId,
    );
    const postpaidComparison = comparisonBody.data.find(
      (item) => item.motherMeter.id === seeded.postpaidMotherMeterId,
    );
    assert.ok(prepaidComparison);
    assert.ok(postpaidComparison);
    assert.equal(prepaidComparison.motherMeterType, null);
    assert.equal(prepaidComparison.totals.tenantPurchasesNetAmount, "130.00");
    assert.equal(prepaidComparison.financialSnapshot.prepaidEstimatedBalance, "50.00");
    assert.equal(postpaidComparison.financialSnapshot.postpaidOutstandingAmount, "50.00");
    assert.equal(postpaidComparison.motherMeter.type, "postpaid");

    const filteredComparisonResponse = await app.request(
      `/api/mobile/landlord-access/properties/${fixture.propertyId}/mother-meter-comparisons?motherMeterType=postpaid`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(filteredComparisonResponse.status, 200);
    const filteredComparisonBody = (await filteredComparisonResponse.json()) as {
      count: number;
      data: { motherMeter: { type: "postpaid" | "prepaid" }; motherMeterType: string | null }[];
    };
    assert.equal(filteredComparisonBody.count, 1);
    assert.equal(filteredComparisonBody.data[0]?.motherMeter.type, "postpaid");
    assert.equal(filteredComparisonBody.data[0]?.motherMeterType, "postpaid");
  });
});
