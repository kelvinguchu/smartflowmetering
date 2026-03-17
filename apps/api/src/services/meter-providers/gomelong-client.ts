import { env } from "../../config";
import { fetchSensitiveWithTimeout } from "../../lib/fetch-sensitive-with-timeout";
import { createGomelongProviderError } from "./gomelong-failure-policy";

export type GomelongMeterType = 1 | 2;
export type GomelongVendingType = 0 | 1;

export interface GomelongRichResult {
  code?: number;
  Code?: number;
  message?: string | null;
  Message?: string | null;
  data?: unknown;
  Data?: unknown;
}

export interface GomelongResult<T = unknown> {
  code: number;
  message: string | null;
  data: T | null;
  raw: unknown;
}

type QueryValue = string | number | boolean | null | undefined;
const GOMELONG_REQUEST_TIMEOUT_MS = 15_000;

export function isGomelongConfigured(): boolean {
  return Boolean(env.GOMELONG_USER_ID && env.GOMELONG_PASSWORD);
}

export function assertGomelongConfigured() {
  const missing: string[] = [];
  if (!env.GOMELONG_USER_ID) missing.push("GOMELONG_USER_ID");
  if (!env.GOMELONG_PASSWORD) missing.push("GOMELONG_PASSWORD");

  if (missing.length > 0) {
    throw createGomelongProviderError({
      message: `Gomelong credentials are not configured: ${missing.join(", ")}`,
    });
  }
}

export async function gomelongGet(
  path: string,
  query: Record<string, QueryValue>,
) {
  assertGomelongConfigured();
  return gomelongRequest(path, { method: "GET", query });
}

export async function gomelongPostForm(
  path: string,
  form: Record<string, QueryValue>,
) {
  assertGomelongConfigured();
  const formData = new FormData();
  for (const [key, value] of Object.entries(form)) {
    if (value === undefined || value === null) continue;
    formData.append(key, String(value));
  }

  return gomelongRequest(path, {
    method: "POST",
    body: formData,
  });
}

export async function gomelongPostJson(
  path: string,
  body: Record<string, unknown>,
  query?: Record<string, QueryValue>,
) {
  assertGomelongConfigured();
  return gomelongRequest(path, {
    method: "POST",
    query,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function gomelongRequest<T = unknown>(
  path: string,
  options: {
    method: "GET" | "POST";
    query?: Record<string, QueryValue>;
    body?: BodyInit | null;
    headers?: Record<string, string>;
  },
): Promise<GomelongResult<T>> {
  const endpoint = new URL(path, env.GOMELONG_API_URL);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null) continue;
      endpoint.searchParams.set(key, String(value));
    }
  }

  const response = await fetchSensitiveWithTimeout(endpoint, {
    method: options.method,
    timeoutMs: GOMELONG_REQUEST_TIMEOUT_MS,
    headers: buildRequestHeaders(options.headers),
    body: options.body,
  });

  const rawText = await response.text();
  const parsed = safeJsonParse(rawText);
  const payload = (parsed ?? {
    Code: response.status,
    Message: rawText,
    Data: null,
  }) as GomelongRichResult;

  if (!response.ok) {
    throw createGomelongProviderError({
      code: response.status,
      message: `Gomelong request failed: HTTP ${response.status}`,
    });
  }

  return {
    code: getCode(payload),
    message: getMessage(payload),
    data: ((payload.data ?? payload.Data) as T | null) ?? null,
    raw: parsed ?? rawText,
  };
}

function buildRequestHeaders(
  headers?: Record<string, string>,
): Record<string, string> {
  if (!headers) {
    return {
      Accept: "application/json, text/plain, */*",
    };
  }

  return {
    Accept: "application/json, text/plain, */*",
    ...headers,
  };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function getCode(payload: GomelongRichResult): number {
  const code = payload.code ?? payload.Code;
  if (typeof code === "number") return code;
  return Number.isFinite(Number(code)) ? Number(code) : Number.NaN;
}

function getMessage(payload: GomelongRichResult): string | null {
  const message = payload.message ?? payload.Message ?? null;
  return typeof message === "string" ? message : null;
}

export function extractToken(data: unknown): string | null {
  if (typeof data === "string") {
    return normalizeToken(data);
  }

  if (!isRecord(data)) {
    return null;
  }

  return extractTokenFromObject(data);
}

function normalizeToken(value: string): string | null {
  const direct = new RegExp(/\d{20}/).exec(value)?.[0];
  if (direct) return direct;

  const digitsOnly = value.replaceAll(/\D/g, "");
  if (digitsOnly.length === 20) return digitsOnly;

  return null;
}

function extractTokenFromObject(data: Record<string, unknown>): string | null {
  for (const field of TOKEN_CANDIDATE_FIELDS) {
    const normalized = normalizePossibleToken(data[field]);
    if (normalized) return normalized;
  }

  for (const value of Object.values(data)) {
    const normalized = normalizePossibleToken(value);
    if (normalized) return normalized;
  }

  return null;
}

function normalizePossibleToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return normalizeToken(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object";
}

const TOKEN_CANDIDATE_FIELDS = [
  "token",
  "Token",
  "stsToken",
  "StsToken",
  "vendingToken",
  "VendingToken",
  "tokenNo",
  "TokenNo",
] as const;
