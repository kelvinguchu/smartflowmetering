import { env } from "../../config";
import {
  assertGomelongConfigured,
  extractToken,
  gomelongGet,
  gomelongPostForm,
  gomelongPostJson,
  type GomelongMeterType,
} from "./gomelong-client";
import { createGomelongProviderError } from "./gomelong-failure-policy";

export {
  isGomelongConfigured,
  assertGomelongConfigured,
  type GomelongMeterType,
  type GomelongVendingType,
  type GomelongResult,
  type GomelongRichResult,
} from "./gomelong-client";

export interface GomelongVendingRequest {
  meterCode: string;
  meterType: GomelongMeterType;
  amountOrQuantity: number;
  vendingType?: 0 | 1;
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
    throw createGomelongProviderError({
      code,
      message: result.message ?? `Gomelong vend failed (${code})`,
    });
  }

  const token = extractToken(result.data);
  if (!token) {
    throw createGomelongProviderError({
      code,
      message: "Gomelong vend succeeded but no STS token was returned",
    });
  }

  return token;
}
