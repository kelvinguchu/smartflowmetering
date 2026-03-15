import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
} from "./helpers";
import {
  loadLandlordByCustomerId,
  loginAsLandlord,
  seedLandlordHistoryFixture,
} from "./landlord-history.fixture";

const app = createApp();

void describe("E2E: landlord history", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns mother meter detail and usage history for the authenticated landlord", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-HISTORY-METER-001");
    const landlord = await loadLandlordByCustomerId(fixture.customerId);
    assert.ok(landlord);

    await seedLandlordHistoryFixture(fixture);
    const token = await loginAsLandlord(app, landlord.phoneNumber);

    const detailResponse = await app.request(
      `/api/mobile/landlord-access/mother-meters/${fixture.motherMeterId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(detailResponse.status, 200);
    const detailBody = (await detailResponse.json()) as {
      data: {
        financials: {
          companyPaymentsToUtility: string;
          prepaidEstimatedBalance: string | null;
          utilityFundingLoaded: string;
        };
        recentEvents: { eventType: string }[];
        recentPurchases: {
          amountPaid?: string;
          commissionAmount?: string;
          meterNumber: string;
          meterCreditAmount: string;
          rateUsed?: string;
        }[];
        subMeters: { meterNumber: string; totalUnitsPurchased: string }[];
      };
    };
    assert.equal(detailBody.data.financials.utilityFundingLoaded, "500.00");
    assert.equal(detailBody.data.financials.companyPaymentsToUtility, "120.00");
    assert.equal(detailBody.data.financials.prepaidEstimatedBalance, "130.00");
    assert.equal(detailBody.data.subMeters[0]?.meterNumber, fixture.meterNumber);
    assert.equal(detailBody.data.subMeters[0]?.totalUnitsPurchased, "9.5000");
    assert.equal(detailBody.data.recentPurchases[0]?.meterCreditAmount, "120.00");
    assert.ok(!("amountPaid" in (detailBody.data.recentPurchases[0] ?? {})));
    assert.ok(!("commissionAmount" in (detailBody.data.recentPurchases[0] ?? {})));
    assert.ok(!("rateUsed" in (detailBody.data.recentPurchases[0] ?? {})));
    assert.ok(
      detailBody.data.recentEvents.some((event) => event.eventType === "bill_payment"),
    );

    const activityResponse = await app.request(
      `/api/mobile/landlord-access/activity?motherMeterId=${fixture.motherMeterId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(activityResponse.status, 200);
    const activityBody = (await activityResponse.json()) as {
      count: number;
      data: {
        commissionAmount?: string;
        amount: string;
        meter: { meterNumber: string } | null;
        motherMeter: { id: string };
        rateUsed?: string;
        type: string;
        unitsPurchased: string | null;
      }[];
      pagination: {
        hasMore: boolean;
        limit: number | null;
        nextOffset: number | null;
        offset: number;
      };
    };
    assert.equal(activityBody.count, 5);
    assert.equal(activityBody.pagination.limit, null);
    assert.equal(activityBody.pagination.offset, 0);
    assert.equal(activityBody.pagination.hasMore, false);
    assert.equal(activityBody.pagination.nextOffset, null);
    assert.ok(activityBody.data.some((item) => item.type === "bill_payment"));
    assert.ok(activityBody.data.some((item) => item.type === "refill"));
    assert.ok(activityBody.data.some((item) => item.type === "initial_deposit"));
    const tenantPurchase = activityBody.data.find((item) => item.type === "tenant_purchase");
    assert.ok(tenantPurchase);
    assert.equal(tenantPurchase.amount, "120.00");
    assert.equal(tenantPurchase.meter?.meterNumber, fixture.meterNumber);
    assert.equal(tenantPurchase.unitsPurchased, "5.0000");
    assert.equal(tenantPurchase.motherMeter.id, fixture.motherMeterId);
    assert.ok(!("commissionAmount" in tenantPurchase));
    assert.ok(!("rateUsed" in tenantPurchase));

    const filteredActivityResponse = await app.request(
      `/api/mobile/landlord-access/activity?propertyId=${fixture.propertyId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(filteredActivityResponse.status, 200);
    const filteredActivityBody = (await filteredActivityResponse.json()) as {
      count: number;
      data: { motherMeter: { id: string } }[];
    };
    assert.equal(filteredActivityBody.count, 5);
    assert.equal(filteredActivityBody.data[0]?.motherMeter.id, fixture.motherMeterId);

    const subMeterResponse = await app.request(
      `/api/mobile/landlord-access/sub-meters/${fixture.meterId}?purchaseLimit=5`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(subMeterResponse.status, 200);
    const subMeterBody = (await subMeterResponse.json()) as {
      data: {
        activity: { totalCompletedPurchases: number };
        meterNumber: string;
        motherMeter: { id: string };
        recentPurchases: {
          amountPaid?: string;
          commissionAmount?: string;
          meterCreditAmount: string;
          rateUsed?: string;
          transactionId: string;
        }[];
        totals: { totalNetSales: string; totalUnitsPurchased: string };
      };
    };
    assert.equal(subMeterBody.data.meterNumber, fixture.meterNumber);
    assert.equal(subMeterBody.data.motherMeter.id, fixture.motherMeterId);
    assert.equal(subMeterBody.data.activity.totalCompletedPurchases, 2);
    assert.equal(subMeterBody.data.totals.totalNetSales, "250.00");
    assert.equal(subMeterBody.data.totals.totalUnitsPurchased, "9.5000");
    assert.equal(subMeterBody.data.recentPurchases[0]?.meterCreditAmount, "120.00");
    assert.ok(subMeterBody.data.recentPurchases[0]?.transactionId);
    assert.ok(!("amountPaid" in (subMeterBody.data.recentPurchases[0] ?? {})));
    assert.ok(!("commissionAmount" in (subMeterBody.data.recentPurchases[0] ?? {})));
    assert.ok(!("rateUsed" in (subMeterBody.data.recentPurchases[0] ?? {})));

    const historyResponse = await app.request(
      `/api/mobile/landlord-access/usage-history?motherMeterId=${fixture.motherMeterId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(historyResponse.status, 200);
    const historyBody = (await historyResponse.json()) as {
      count: number;
      data: {
        date: string;
        meterCreditAmountTotal: string;
        motherMeter: { id: string };
        subMeters: { meterNumber: string; transactionCount: number }[];
        totals: { transactionCount: number; unitsPurchased: string };
      }[];
      pagination: {
        hasMore: boolean;
        limit: number | null;
        nextOffset: number | null;
        offset: number;
      };
    };
    assert.equal(historyBody.count, 2);
    assert.equal(historyBody.pagination.limit, null);
    assert.equal(historyBody.pagination.offset, 0);
    assert.equal(historyBody.pagination.hasMore, false);
    assert.equal(historyBody.pagination.nextOffset, null);
    assert.equal(historyBody.data[0]?.motherMeter.id, fixture.motherMeterId);
    assert.equal(historyBody.data[0]?.meterCreditAmountTotal, "120.00");
    assert.equal(historyBody.data[0]?.totals.transactionCount, 1);
    assert.equal(historyBody.data[0]?.totals.unitsPurchased, "5.0000");
    assert.equal(historyBody.data[1]?.meterCreditAmountTotal, "130.00");
    assert.equal(historyBody.data[1]?.subMeters[0]?.meterNumber, fixture.meterNumber);
    assert.equal(historyBody.data[1]?.subMeters[0]?.transactionCount, 1);

    const filteredHistoryResponse = await app.request(
      `/api/mobile/landlord-access/usage-history?propertyId=${fixture.propertyId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(filteredHistoryResponse.status, 200);
    const filteredHistoryBody = (await filteredHistoryResponse.json()) as {
      count: number;
      data: { motherMeter: { id: string } }[];
    };
    assert.equal(filteredHistoryBody.count, 2);
    assert.equal(filteredHistoryBody.data[0]?.motherMeter.id, fixture.motherMeterId);
  });
});
