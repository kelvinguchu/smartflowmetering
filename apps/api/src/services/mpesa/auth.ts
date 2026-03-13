import { env } from "../../config";
import { fetchSensitiveWithTimeout } from "../../lib/fetch-sensitive-with-timeout";
import { getMpesaApiUrls } from "./constants";

let cachedToken: { token: string; expiresAt: number } | null = null;
const MPESA_OAUTH_TIMEOUT_MS = 15_000;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const urls = getMpesaApiUrls(env.MPESA_ENVIRONMENT, env.MPESA_BASE_URL);
  const response = await fetchSensitiveWithTimeout(urls.oauth, {
    method: "GET",
    timeoutMs: MPESA_OAUTH_TIMEOUT_MS,
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`M-Pesa OAuth failed: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: string;
  };

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (Number.parseInt(data.expires_in, 10) - 60) * 1000,
  };

  return cachedToken.token;
}
