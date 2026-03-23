export type RedisConnectionConfig = {
  db?: number;
  host: string;
  password?: string;
  port: number;
  tls?: Record<string, never>;
  username?: string;
};

export function parseRedisUrl(url: string): RedisConnectionConfig {
  const parsed = new URL(url);
  const database = parseDatabaseIndex(parsed.pathname);

  return {
    db: database,
    host: parsed.hostname,
    password: parsed.password || undefined,
    port: Number.parseInt(parsed.port, 10) || 6379,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    username: parsed.username || undefined,
  };
}

function parseDatabaseIndex(pathname: string): number | undefined {
  const trimmedPath = pathname.replace(/^\/+/, "");
  if (trimmedPath.length === 0) {
    return undefined;
  }

  const database = Number.parseInt(trimmedPath, 10);
  if (Number.isNaN(database)) {
    throw new TypeError(
      `Invalid Redis database index in REDIS_URL: ${pathname}`,
    );
  }

  return database;
}
