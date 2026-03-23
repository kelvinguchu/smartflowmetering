import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../../db";
import { smsLogs } from "../../db/schema";
import type { SmsRecoverySyncResult } from "./sms-recovery.types";
import { syncTextSmsDeliveryStatus } from "./textsms-dlr.service";

export async function syncSmsDeliveryStatusById(
  smsLogId: string,
): Promise<SmsRecoverySyncResult> {
  const log = await db.query.smsLogs.findFirst({
    where: eq(smsLogs.id, smsLogId),
    columns: {
      id: true,
      provider: true,
    },
  });

  if (!log) {
    throw new HTTPException(404, { message: "SMS log not found" });
  }

  if (log.provider !== "textsms") {
    throw new HTTPException(400, {
      message: "Only TextSMS logs support pull-based delivery sync",
    });
  }

  return syncTextSmsDeliveryStatus(log.id);
}


