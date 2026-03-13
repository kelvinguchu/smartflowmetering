import { fetchWithTimeout } from "./fetch-with-timeout";

export async function fetchSensitiveWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
) {
  return fetchWithTimeout(input, {
    ...init,
    cache: "no-store",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
}
