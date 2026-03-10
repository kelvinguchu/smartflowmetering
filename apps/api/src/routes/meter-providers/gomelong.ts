import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAdmin, type AppBindings } from "../../lib/auth-middleware";
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
} from "../../services/meter-providers/gomelong.service";
import {
  sgcQuerySchema,
  changeDecoderQuerySchema,
  clearTokenQuerySchema,
  contractInfoQuerySchema,
  maxPowerQuerySchema,
  vendingQuerySchema,
  meterDeleteBodySchema,
  meterRegisterBodySchema,
  meterUpdateBodySchema,
  addUseTypeBodySchema,
  updateUseTypeBodySchema,
  useTypeParamSchema,
  waterVendPageQuerySchema,
  waterVendPageBodySchema,
} from "../../validators/gomelong";

export const gomelongRoutes = new Hono<AppBindings>();

gomelongRoutes.use("*", requireAdmin);

gomelongRoutes.get("/health", (c) =>
  c.json({
    configured: isGomelongConfigured(),
  }),
);

gomelongRoutes.get(
  "/kmf/sgc",
  zValidator("query", sgcQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listSgcByMeterType(query.meterType);
    return providerResponse(c, result);
  },
);

gomelongRoutes.get(
  "/power/change-decoder-token",
  zValidator("query", changeDecoderQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getChangeDecoderToken({
      meterCode: query.meterCode,
      meterType: query.meterType,
      sgcId: query.sgcId,
    });
    return providerResponse(c, result);
  },
);

gomelongRoutes.get(
  "/power/clear-credit-token",
  zValidator("query", clearTokenQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getClearCreditToken({
      meterCode: query.meterCode,
      meterType: query.meterType,
    });
    return providerResponse(c, result);
  },
);

gomelongRoutes.get(
  "/power/clear-tamper-token",
  zValidator("query", clearTokenQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getClearTamperSignToken({
      meterCode: query.meterCode,
      meterType: query.meterType,
    });
    return providerResponse(c, result);
  },
);

gomelongRoutes.get(
  "/power/contract-info",
  zValidator("query", contractInfoQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getContractInfo({
      meterCode: query.meterCode,
      meterType: query.meterType,
    });
    return providerResponse(c, result);
  },
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
  },
);

gomelongRoutes.get(
  "/power/vending-token",
  zValidator("query", vendingQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await getVendingToken({
      meterCode: query.meterCode,
      meterType: query.meterType,
      amountOrQuantity: query.amountOrQuantity,
      vendingType: query.vendingType ?? undefined,
    });
    return providerResponse(c, result);
  },
);

gomelongRoutes.post(
  "/power/meter-delete",
  zValidator("json", meterDeleteBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await meterDelete({
      meterCode: body.meterCode,
      meterType: body.meterType,
    });
    return providerResponse(c, result);
  },
);

gomelongRoutes.post(
  "/power/meter-register",
  zValidator("json", meterRegisterBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await meterRegister({
      useTypeId: body.useTypeId,
      meterCode: body.meterCode,
      meterType: body.meterType,
      customerName: body.customerName,
      address: body.address,
      phoneNumber: body.phoneNumber,
      fax: body.fax,
      sgcId: body.sgcId,
      billingMode: body.billingMode ?? undefined,
    });
    return providerResponse(c, result);
  },
);

gomelongRoutes.post(
  "/power/meter-update",
  zValidator("json", meterUpdateBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await meterUpdate({
      meterCode: body.meterCode,
      meterType: body.meterType,
      customerName: body.customerName,
      address: body.address,
      phoneNumber: body.phoneNumber,
      useTypeId: body.useTypeId,
      sgcId: body.sgcId,
      billingMode: body.billingMode ?? undefined,
    });
    return providerResponse(c, result);
  },
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
      meterType: body.meterType,
      price: body.price,
      vat: body.vat,
    });
    return providerResponse(c, result);
  },
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
  },
);

gomelongRoutes.delete(
  "/use-types/:useTypeId",
  zValidator("param", useTypeParamSchema),
  async (c) => {
    const { useTypeId } = c.req.valid("param");
    const result = await deleteUseType(useTypeId);
    return providerResponse(c, result);
  },
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
  },
);

function providerResponse(
  c: Context<AppBindings>,
  result: { code: number; message: string | null; data: unknown; raw: unknown },
) {
  const ok = result.code === 0;
  return c.json(
    {
      success: ok,
      provider: result,
    },
    ok ? 200 : 502,
  );
}
