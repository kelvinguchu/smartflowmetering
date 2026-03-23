// Preload script for host-side E2E tests.
// Rewrites DATABASE_URL and REDIS_URL to use localhost instead of
// Docker-internal service hostnames (postgres, redis).
//
// Loaded via: node --import tsx --import ./scripts/e2e-env-setup.ts ...

const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, REDIS_PASSWORD } =
  process.env;

if (POSTGRES_USER && POSTGRES_PASSWORD && POSTGRES_DB) {
  process.env.DATABASE_URL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}`;
}

if (REDIS_PASSWORD) {
  process.env.REDIS_URL = `redis://:${REDIS_PASSWORD}@localhost:6379`;
}
