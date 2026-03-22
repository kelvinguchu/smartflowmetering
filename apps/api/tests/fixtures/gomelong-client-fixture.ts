export {};

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/smartflowmetering";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.GOMELONG_USER_ID = "gomelong-user";
process.env.GOMELONG_PASSWORD = ["gomelong", "test", "secret"].join("-");

const { withGomelongCredentials } =
  await import("../../src/services/meter-providers/gomelong-client");

const payload = withGomelongCredentials({
  MeterCode: "12345678",
  MeterType: 1,
});
process.stdout.write(JSON.stringify(payload));
