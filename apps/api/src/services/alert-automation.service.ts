import { env } from "../config";
import { queueCustomerPrompts } from "./customer-prompts.service";
import { queueDailyLandlordUsageSummarySms } from "./daily-usage-sms.service";
import {
  queueLowBalanceNotifications,
  queuePostpaidReminderNotifications,
} from "./mother-meter-alerts.service";
import { runSmsProviderAlerts } from "./sms-provider-alerts.service";

let automationTimer: NodeJS.Timeout | null = null;
let cycleRunning = false;

export function startAlertAutomation(): void {
  if (!env.ALERT_AUTOMATION_ENABLED || env.NODE_ENV === "test") {
    return;
  }

  const intervalMs = env.ALERT_AUTOMATION_INTERVAL_SECONDS * 1000;
  console.log(
    `[Alerts Automation] Enabled (interval: ${env.ALERT_AUTOMATION_INTERVAL_SECONDS}s)`,
  );

  void runAlertAutomationCycle();
  automationTimer = setInterval(() => {
    void runAlertAutomationCycle();
  }, intervalMs);
}

export function stopAlertAutomation(): void {
  if (!automationTimer) {
    return;
  }
  clearInterval(automationTimer);
  automationTimer = null;
}

async function runAlertAutomationCycle(): Promise<void> {
  if (cycleRunning) {
    return;
  }
  cycleRunning = true;

  try {
    const [lowBalanceResult, postpaidReminderResult, smsProviderAlertResult] =
      await Promise.all([
        queueLowBalanceNotifications({
          dedupeWindowHours: env.LOW_BALANCE_ALERT_DEDUPE_HOURS,
        }),
        queuePostpaidReminderNotifications({
          dedupeWindowHours: env.POSTPAID_REMINDER_DEDUPE_HOURS,
          daysAfterLastPayment: env.POSTPAID_REMINDER_DAYS_AFTER_PAYMENT,
        }),
        env.SMS_PROVIDER_ALERT_AUTOMATION_ENABLED
          ? runSmsProviderAlerts({})
          : Promise.resolve(null),
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

    let customerPromptResult: Awaited<
      ReturnType<typeof queueCustomerPrompts>
    > | null = null;
    if (env.CUSTOMER_PROMPTS_ENABLED) {
      customerPromptResult = await queueCustomerPrompts({
        limit: env.CUSTOMER_PROMPTS_MAX_PER_RUN,
        maxPrompts: env.CUSTOMER_PROMPTS_MAX_PER_RUN,
        type: "all",
      });
    }

    console.log("[Alerts Automation] Cycle complete", {
      customerPrompts: customerPromptResult,
      lowBalance: lowBalanceResult,
      postpaidReminders: postpaidReminderResult,
      dailyUsageSms: dailyUsageResult,
      smsProviderAlerts: smsProviderAlertResult,
    });
  } catch (error) {
    console.error("[Alerts Automation] Cycle failed:", error);
  } finally {
    cycleRunning = false;
  }
}

function shouldRunDailyUsageAtCurrentHour(
  date: Date,
  timezone: string,
): boolean {
  const hour = getHourInTimezone(date, timezone);
  return hour === env.LANDLORD_DAILY_USAGE_SMS_HOUR;
}

function getHourInTimezone(date: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).format(date);

  const parsed = Number.parseInt(hour, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}
