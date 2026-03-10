import { env } from "../config";

export type GomelongMeterType = 1 | 2;
export type GomelongVendingType = 0 | 1;

export interface GomelongVendingRequest {
  meterCode: string;
  meterType: GomelongMeterType;
  amountOrQuantity: number;
  vendingType?: GomelongVendingType;
}

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

export function isGomelongConfigured(): boolean {
  return Boolean(env.GOMELONG_USER_ID && env.GOMELONG_PASSWORD);
}

export function assertGomelongConfigured() {
  const missing: string[] = [];
  if (!env.GOMELONG_USER_ID) missing.push("GOMELONG_USER_ID");
  if (!env.GOMELONG_PASSWORD) missing.push("GOMELONG_PASSWORD");

  if (missing.length > 0) {
    throw new Error(
      `Gomelong credentials are not configured: ${missing.join(", ")}`,
    );
  }
}

export async function listSgcByMeterType(meterType: GomelongMeterType) {
  return gomelongGet("/api/Kmf/ListSgcByMeterType", { meterType });
}

export async function getChangeDecoderToken(request: {
  meterCode: string;
  meterType: GomelongMeterType;
  sgcId: string;
}) {
  return gomelongGet("/api/Power/GetChangeDecoderToken", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    MeterCode: request.meterCode,
    MeterType: request.meterType,
    SgcId: request.sgcId,
  });
}

export async function getClearCreditToken(request: {
  meterCode: string;
  meterType: GomelongMeterType;
}) {
  return gomelongGet("/api/Power/GetClearCreditToken", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    MeterCode: request.meterCode,
    MeterType: request.meterType,
  });
}

export async function getClearTamperSignToken(request: {
  meterCode: string;
  meterType: GomelongMeterType;
}) {
  return gomelongGet("/api/Power/GetClearTamperSignToken", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    MeterCode: request.meterCode,
    MeterType: request.meterType,
  });
}

export async function getContractInfo(request: {
  meterCode: string;
  meterType: GomelongMeterType;
}) {
  return gomelongGet("/api/Power/GetContractInfo", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    MeterType: request.meterType,
    MeterCode: request.meterCode,
  });
}

export async function getMaxPowerToken(request: {
  meterCode: string;
  power: number;
}) {
  return gomelongGet("/api/Power/GetMaxPowerToken", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    MeterCode: request.meterCode,
    Power: request.power,
  });
}

export async function getVendingToken(request: GomelongVendingRequest) {
  const vendingType = request.vendingType ?? env.GOMELONG_VENDING_TYPE;

  return gomelongGet("/api/Power/GetVendingToken", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    MeterType: request.meterType,
    MeterCode: request.meterCode,
    AmountOrQuantity: request.amountOrQuantity,
    VendingType: vendingType,
  });
}

export async function meterDelete(request: {
  meterCode: string;
  meterType: GomelongMeterType;
}) {
  return gomelongPostForm("/api/Power/MeterDelete", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    MeterCode: request.meterCode,
    MeterType: request.meterType,
  });
}

export async function meterRegister(request: {
  useTypeId: string;
  meterCode: string;
  meterType: GomelongMeterType;
  customerName: string;
  address?: string;
  phoneNumber?: string;
  fax?: string;
  sgcId?: string;
  billingMode?: 0 | 1;
}) {
  return gomelongPostForm("/api/Power/MeterRegister", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    UseTypeId: request.useTypeId,
    MeterCode: request.meterCode,
    MeterType: request.meterType,
    CustomerName: request.customerName,
    Address: request.address,
    PhoneNumber: request.phoneNumber,
    Fax: request.fax,
    SgcId: request.sgcId,
    BillingMode: request.billingMode,
  });
}

export async function meterUpdate(request: {
  meterCode: string;
  meterType: GomelongMeterType;
  customerName: string;
  address?: string;
  phoneNumber?: string;
  useTypeId?: string;
  sgcId?: string;
  billingMode?: 0 | 1;
}) {
  return gomelongPostForm("/api/Power/MeterUpdate", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    MeterCode: request.meterCode,
    MeterType: request.meterType,
    CustomerName: request.customerName,
    Address: request.address,
    PhoneNumber: request.phoneNumber,
    UseTypeId: request.useTypeId,
    SgcId: request.sgcId,
    BillingMode: request.billingMode,
  });
}

export async function addUseType(request: {
  useTypeId: string;
  useTypeName: string;
  meterType: GomelongMeterType;
  price: number;
  vat: number;
}) {
  return gomelongPostForm("/api/UseType/AddUseType", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    UseTypeId: request.useTypeId,
    UseTypeName: request.useTypeName,
    MeterType: request.meterType,
    Price: request.price,
    Vat: request.vat,
  });
}

export async function deleteUseType(useTypeId: string) {
  return gomelongPostForm("/api/UseType/DeleteUseType", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    UseTypeId: useTypeId,
  });
}

export async function updateUseType(request: {
  useTypeId: string;
  price: number;
  vat: number;
}) {
  return gomelongPostForm("/api/UseType/UpdateUseType", {
    UserId: env.GOMELONG_USER_ID,
    Password: env.GOMELONG_PASSWORD,
    UseTypeId: request.useTypeId,
    Price: request.price,
    Vat: request.vat,
  });
}

export async function useTypeList() {
  return gomelongGet("/api/UseType/UseTypeList", {
    userId: env.GOMELONG_USER_ID,
    password: env.GOMELONG_PASSWORD,
  });
}

export async function pageWaterVend(request: {
  meterCode: string;
  startDate: string;
  endDate: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  return gomelongPostJson(
    "/api/WaterVend/PageVend",
    {
      userId: env.GOMELONG_USER_ID,
      password: env.GOMELONG_PASSWORD,
      meterCode: request.meterCode,
      startDate: request.startDate,
      endDate: request.endDate,
    },
    {
      PageNumber: request.pageNumber,
      PageSize: request.pageSize,
    },
  );
}

export async function vendTokenWithGomelong(
  request: GomelongVendingRequest,
): Promise<string> {
  assertGomelongConfigured();
  const result = await getVendingToken(request);
  const code = result.code;
  if (code !== 0) {
    throw new Error(
      `Gomelong vend failed (${code}): ${result.message ?? "unknown error"}`,
    );
  }

  const token = extractToken(result.data);
  if (!token) {
    throw new Error("Gomelong vend succeeded but no STS token was returned");
  }

  return token;
}

async function gomelongGet(path: string, query: Record<string, QueryValue>) {
  assertGomelongConfigured();
  return gomelongRequest(path, { method: "GET", query });
}

async function gomelongPostForm(
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

async function gomelongPostJson(
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

  const response = await fetch(endpoint, {
    method: options.method,
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
    throw new Error(
      `Gomelong HTTP ${response.status}: ${getMessage(payload) ?? "request failed"}`,
    );
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

function extractToken(data: unknown): string | null {
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
