import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../../lib/auth-middleware";
import { requireAuth } from "../../lib/auth-middleware";
import {
  acknowledgeTotpEnrollmentPrompt,
  getAuthSecurityProfile,
  updatePreferredTwoFactorMethod,
} from "../../services/admin/auth-security.service";
import { updatePreferredTwoFactorMethodSchema } from "../../validators/auth-security";

export const authSecurityRoutes = new Hono<AppBindings>();

authSecurityRoutes.use("*", requireAuth);

authSecurityRoutes.get("/profile", async (c) => {
  const currentUser = c.get("user");
  const profile = await getAuthSecurityProfile(currentUser.id);
  return c.json({ data: profile });
});

authSecurityRoutes.post("/totp-prompt/acknowledge", async (c) => {
  const currentUser = c.get("user");
  const profile = await acknowledgeTotpEnrollmentPrompt({
    headers: c.req.raw.headers,
    user: currentUser,
  });

  return c.json({ data: profile });
});

authSecurityRoutes.post(
  "/preferred-method",
  zValidator("json", updatePreferredTwoFactorMethodSchema),
  async (c) => {
    const currentUser = c.get("user");
    const body = c.req.valid("json");
    const profile = await updatePreferredTwoFactorMethod(
      { headers: c.req.raw.headers, user: currentUser },
      body,
    );

    return c.json({ data: profile });
  },
);




