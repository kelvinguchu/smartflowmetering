import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isResendJob, isNotificationJob } from "../src/queues/sms-guards";
import type {
  SmsDeliveryJob,
  SmsNotificationJob,
  SmsResendJob,
  SmsJob,
} from "../src/queues/types";

const resendJob: SmsResendJob = {
  kind: "resend",
  smsLogId: "log-1",
  phoneNumber: "254700000000",
  messageBody: "Your token is ...",
};

const notificationJob: SmsNotificationJob = {
  kind: "notification",
  phoneNumber: "254700000000",
  messageBody: "Your application was approved",
};

const deliveryJob: SmsDeliveryJob = {
  transactionId: "txn-1",
  phoneNumber: "254700000000",
  meterNumber: "12345",
  token: "0000-1111-2222-3333",
  units: "10",
  amount: "100",
};

describe("isResendJob", () => {
  it("returns true for a resend job", () => {
    assert.equal(isResendJob(resendJob), true);
  });

  it("returns false for a notification job", () => {
    assert.equal(isResendJob(notificationJob), false);
  });

  it("returns false for a delivery job (no kind field)", () => {
    assert.equal(isResendJob(deliveryJob), false);
  });
});

describe("isNotificationJob", () => {
  it("returns true for a notification job", () => {
    assert.equal(isNotificationJob(notificationJob), true);
  });

  it("returns false for a resend job", () => {
    assert.equal(isNotificationJob(resendJob), false);
  });

  it("returns false for a delivery job (no kind field)", () => {
    assert.equal(isNotificationJob(deliveryJob), false);
  });
});

describe("SmsJob dispatch path", () => {
  it("delivery job falls through both guards to the default path", () => {
    const job: SmsJob = deliveryJob;
    assert.equal(isResendJob(job), false);
    assert.equal(isNotificationJob(job), false);
    // If both guards are false, processSmsDelivery would handle it
  });
});
