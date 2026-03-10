import { Hono } from "hono";
import type { AppBindings } from "../../lib/auth-middleware";
import { registerStkRoutes } from "./stk-routes";
import { registerValidationRoutes } from "./validation-routes";

export const mpesaRoutes = new Hono<AppBindings>();

registerValidationRoutes(mpesaRoutes);
registerStkRoutes(mpesaRoutes);
