import { env } from "../config";
import {
  queueDailyLandlordUsageSummarySms,
  queueLowBalanceNotifications,
  queuePostpaidReminderNotifications,
} from "./mother-meter-alerts.service";

let automationTimer: NodeJS.Timeout | null = null;
let cycleRunning = false;

export function startAlertAutomation(): void {
  if (!env.ALERT_AUTOMATION_ENABLED || env.NODE_ENV === "test") {
    return;
  }

  const intervalMs = env.ALERT_AUTOMATION_INTERVAL_SECONDS * 1000;
  console.log(
    `[Alerts Automation] Enabled (interval: ${env.ALERT_AUTOMATION_INTERVAL_SECONDS}s)`
  );

  void runAlertAutomationCycle();
  automationTimer = setInterval(() => {
    void runAlertAutomationCycle();
  }, intervalMs);
}

export function stopAlertAutomation(): void {
  if (!automationTimer) return;
  clearInterval(automationTimer);
  automationTimer = null;
}

async function runAlertAutomationCycle(): Promise<void> {
  if (cycleRunning) return;
  cycleRunning = true;

  try {
    const [lowBalanceResult, postpaidReminderResult] = await Promise.all([
      queueLowBalanceNotifications({
        dedupeWindowHours: env.LOW_BALANCE_ALERT_DEDUPE_HOURS,
      }),
      queuePostpaidReminderNotifications({
        dedupeWindowHours: env.POSTPAID_REMINDER_DEDUPE_HOURS,
        daysAfterLastPayment: env.POSTPAID_REMINDER_DAYS_AFTER_PAYMENT,
      }),
    ]);

    let dailyUsageResult: Awaited<
      ReturnType<typeof queueDailyLandlordUsageSummarySms>
    > | null = null;
    if (
      env.LANDLORD_DAILY_USAGE_SMS_ENABLED &&
      shouldRunDailyUsageAtCurrentHour(new Date(), env.ALERT_TIMEZONE)
    ) {
      dailyUsageResult = await queueDailyLandlordUsageSummarySms({
        timezone: env.ALERT_TIMEZONE,
      });
    }

    console.log(
      "[Alerts Automation] Cycle complete",
      {
        lowBalance: lowBalanceResult,
        postpaidReminders: postpaidReminderResult,
        dailyUsageSms: dailyUsageResult,
      }
    );
  } catch (error) {
    console.error("[Alerts Automation] Cycle failed:", error);
  } finally {
    cycleRunning = false;
  }
}

function shouldRunDailyUsageAtCurrentHour(date: Date, timezone: string): boolean {
  const hour = getHourInTimezone(date, timezone);
  return hour >= env.LANDLORD_DAILY_USAGE_SMS_HOUR;
}

function getHourInTimezone(date: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).format(date);

  const parsed = Number.parseInt(hour, 10);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}
