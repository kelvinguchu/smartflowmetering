import type { CustomerAppNotificationType } from "./customer-app-notification-types";

export function formatTenantAppNotification(input: {
  amountPaid?: string;
  meterNumber: string;
  meterStatus?: string;
  type: CustomerAppNotificationType;
  unitsPurchased?: string;
}): { message: string; title: string } {
  if (input.type === "token_purchase_recorded") {
    return {
      message: `We have recorded your token purchase for meter ${input.meterNumber}. Token generation is in progress.`,
      title: "Purchase recorded",
    };
  }

  if (input.type === "token_delivery_available") {
    return {
      message: `Your token for meter ${input.meterNumber} is ready in the app.`,
      title: "Token ready",
    };
  }

  if (input.type === "meter_status_alert") {
    const statusLabel = input.meterStatus ?? "updated";
    return {
      message: `Meter ${input.meterNumber} status is now ${statusLabel}. Open the app for the latest update.`,
      title: "Meter status changed",
    };
  }

  if (input.type === "failed_purchase_follow_up") {
    return {
      message: `We could not complete your token purchase for meter ${input.meterNumber}. Please try again or contact support if you need help.`,
      title: "Purchase needs attention",
    };
  }

  return {
    message: `Meter ${input.meterNumber} has no recent token purchase. Buy tokens early to avoid interruption.`,
    title: "Buy token reminder",
  };
}
