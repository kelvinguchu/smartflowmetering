import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin, type AppBindings } from "../lib/auth-middleware";
import {
  addUseType,
  deleteUseType,
  getChangeDecoderToken,
  getClearCreditToken,
  getClearTamperSignToken,
  getContractInfo,
  getMaxPowerToken,
  getVendingToken,
  isGomelongConfigured,
  listSgcByMeterType,
  meterDelete,
  meterRegister,
  meterUpdate,
  pageWaterVend,
  updateUseType,
  useTypeList,
} from "../services/gomelong.service";

const meterTypeSchema = z.coerce.number().int().refine((value) => value === 1 || value === 2);
const vendingTypeSchema = z.coerce.number().int().refine((value) => value === 0 || value === 1);
const meterCodeSchema = z.string().min(1).max(32);

const sgcQuerySchema = z.object({
  meterType: meterTypeSchema,
});

const contractInfoQuerySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
});

const changeDecoderQuerySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
  sgcId: z.string().min(1),
});

const clearTokenQuerySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
});

const maxPowerQuerySchema = z.object({
  meterCode: meterCodeSchema,
  power: z.coerce.number().int().positive(),
});

const vendingQuerySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
  amountOrQuantity: z.coerce.number().positive(),
  vendingType: vendingTypeSchema.optional(),
});

const meterDeleteBodySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
});

const meterRegisterBodySchema = z.object({
  useTypeId: z.string().min(1),
  meterCode: z.string().min(1),
  meterType: meterTypeSchema,
  customerName: z.string().min(1),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  fax: z.string().optional(),
  sgcId: z.string().optional(),
  billingMode: vendingTypeSchema.optional(),
});

const meterUpdateBodySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
  customerName: z.string().min(1),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  useTypeId: z.string().optional(),
  sgcId: z.string().optional(),
  billingMode: vendingTypeSchema.optional(),
});

const addUseTypeBodySchema = z.object({
  useTypeId: z.string().min(1),
  useTypeName: z.string().min(1),
  meterType: meterTypeSchema,
  price: z.coerce.number().positive(),
  vat: z.coerce.number().min(0),
});

const updateUseTypeBodySchema = z.object({
  price: z.coerce.number().positive(),
  vat: z.coerce.number().min(0),
});

const useTypeParamSchema = z.object({
  useTypeId: z.string().min(1),
});

const waterVendPageQuerySchema = z.object({
  pageNumber: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const waterVendPageBodySchema = z.object({
  meterCode: meterCodeSchema,
  startDate: z.string().date(),
  endDate: z.string().date(),
});

export const gomelongRoutes = new Hono<AppBindings>();

gomelongRoutes.use("*", requireAdmin);

gomelongRoutes.get("/health", (c) =>
  c.json({
    configured: isGomelongConfigured(),
  })
);

gomelongRoutes.get("/kmf/sgc", zValidator("query", sgcQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await listSgcByMeterType(query.meterType as 1 | 2);
  return providerResponse(c, result);
});

gomelongRoutes.get(
  "/power/change-decoder-token",
  zValidator("query", changeDecoderQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getChangeDecoderToken({
      meterCode: query.meterCode,
      meterType: query.meterType as 1 | 2,
      sgcId: query.sgcId,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.get(
  "/power/clear-credit-token",
  zValidator("query", clearTokenQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getClearCreditToken({
      meterCode: query.meterCode,
      meterType: query.meterType as 1 | 2,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.get(
  "/power/clear-tamper-token",
  zValidator("query", clearTokenQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getClearTamperSignToken({
      meterCode: query.meterCode,
      meterType: query.meterType as 1 | 2,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.get(
  "/power/contract-info",
  zValidator("query", contractInfoQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getContractInfo({
      meterCode: query.meterCode,
      meterType: query.meterType as 1 | 2,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.get(
  "/power/max-power-token",
  zValidator("query", maxPowerQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getMaxPowerToken({
      meterCode: query.meterCode,
      power: query.power,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.get(
  "/power/vending-token",
  zValidator("query", vendingQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getVendingToken({
      meterCode: query.meterCode,
      meterType: query.meterType as 1 | 2,
      amountOrQuantity: query.amountOrQuantity,
      vendingType: (query.vendingType as 0 | 1 | undefined) ?? undefined,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.post(
  "/power/meter-delete",
  zValidator("json", meterDeleteBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await meterDelete({
      meterCode: body.meterCode,
      meterType: body.meterType as 1 | 2,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.post(
  "/power/meter-register",
  zValidator("json", meterRegisterBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await meterRegister({
      useTypeId: body.useTypeId,
      meterCode: body.meterCode,
      meterType: body.meterType as 1 | 2,
      customerName: body.customerName,
      address: body.address,
      phoneNumber: body.phoneNumber,
      fax: body.fax,
      sgcId: body.sgcId,
      billingMode: (body.billingMode as 0 | 1 | undefined) ?? undefined,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.post(
  "/power/meter-update",
  zValidator("json", meterUpdateBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await meterUpdate({
      meterCode: body.meterCode,
      meterType: body.meterType as 1 | 2,
      customerName: body.customerName,
      address: body.address,
      phoneNumber: body.phoneNumber,
      useTypeId: body.useTypeId,
      sgcId: body.sgcId,
      billingMode: (body.billingMode as 0 | 1 | undefined) ?? undefined,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.get("/use-types", async (c) => {
  const result = await useTypeList();
  return providerResponse(c, result);
});

gomelongRoutes.post(
  "/use-types",
  zValidator("json", addUseTypeBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await addUseType({
      useTypeId: body.useTypeId,
      useTypeName: body.useTypeName,
      meterType: body.meterType as 1 | 2,
      price: body.price,
      vat: body.vat,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.patch(
  "/use-types/:useTypeId",
  zValidator("param", useTypeParamSchema),
  zValidator("json", updateUseTypeBodySchema),
  async (c) => {
    const { useTypeId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await updateUseType({
      useTypeId,
      price: body.price,
      vat: body.vat,
    });
    return providerResponse(c, result);
  }
);

gomelongRoutes.delete(
  "/use-types/:useTypeId",
  zValidator("param", useTypeParamSchema),
  async (c) => {
    const { useTypeId } = c.req.valid("param");
    const result = await deleteUseType(useTypeId);
    return providerResponse(c, result);
  }
);

gomelongRoutes.post(
  "/water-vend/page",
  zValidator("query", waterVendPageQuerySchema),
  zValidator("json", waterVendPageBodySchema),
  async (c) => {
    const query = c.req.valid("query");
    const body = c.req.valid("json");
    const result = await pageWaterVend({
      meterCode: body.meterCode,
      startDate: body.startDate,
      endDate: body.endDate,
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
    });
    return providerResponse(c, result);
  }
);

function providerResponse(
  c: Context<AppBindings>,
  result: { code: number; message: string | null; data: unknown; raw: unknown }
) {
  const ok = result.code === 0;
  return c.json(
    {
      success: ok,
      provider: result,
    },
    ok ? 200 : 502
  );
}
