export const customerAppNotificationTypes = [
  "buy_token_nudge",
  "failed_purchase_follow_up",
  "landlord_daily_usage_summary",
  "landlord_mother_meter_event_recorded",
  "landlord_postpaid_payment_due",
  "landlord_prepaid_low_balance",
  "landlord_sub_meter_purchase",
  "meter_status_alert",
  "token_delivery_available",
  "token_purchase_recorded",
] as const;

export type CustomerAppNotificationType =
  (typeof customerAppNotificationTypes)[number];

export const tenantAppNotificationTypes = [
  "buy_token_nudge",
  "failed_purchase_follow_up",
  "meter_status_alert",
  "token_delivery_available",
  "token_purchase_recorded",
] as const;

export const landlordAppNotificationTypes = [
  "landlord_daily_usage_summary",
  "landlord_mother_meter_event_recorded",
  "landlord_prepaid_low_balance",
  "landlord_sub_meter_purchase",
] as const;

export type TenantAppNotificationType =
  (typeof tenantAppNotificationTypes)[number];
export type LandlordAppNotificationType =
  (typeof landlordAppNotificationTypes)[number];
