export const API_URLS = {
  sandbox: {
    oauth:
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    stkPush: "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    stkQuery: "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
  },
  production: {
    oauth:
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    stkPush: "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    stkQuery: "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query",
  },
} as const;

export const SANDBOX_CREDENTIALS = {
  shortcode: "174379",
  passkey: "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
} as const;

const API_BASE_URLS = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
} as const;

export function getMpesaApiUrls(
  environment: "sandbox" | "production",
  baseUrlOverride?: string
) {
  const baseUrl = normalizeBaseUrl(baseUrlOverride || API_BASE_URLS[environment]);
  return {
    oauth: `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    stkPush: `${baseUrl}/mpesa/stkpush/v1/processrequest`,
    stkQuery: `${baseUrl}/mpesa/stkpushquery/v1/query`,
  } as const;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replaceAll(/\/+$/g, "");
}
