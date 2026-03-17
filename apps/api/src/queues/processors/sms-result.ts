export interface SmsProcessResult {
  messageId: string | null;
}

export function finalizeSmsProcessResult(
  messageId: string | undefined,
  context: "delivery" | "notification" | "resend",
): SmsProcessResult {
  if (!messageId) {
    console.warn(
      `[SMS] ${capitalizeContext(context)} succeeded without a provider message id`,
    );
    return { messageId: null };
  }

  return { messageId };
}

function capitalizeContext(context: "delivery" | "notification" | "resend") {
  return context.charAt(0).toUpperCase() + context.slice(1);
}
