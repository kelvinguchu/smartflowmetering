import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

// Connection string from environment
const connectionString = process.env.DATABASE_URL!;

// Create postgres client
// For query purposes (connection pool)
const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance with schema
export const db = drizzle(queryClient, { schema });

// Re-export schema for convenience
export * as schema from "./schema/index";

// Export type for db instance
export type Database = typeof db;

// Graceful shutdown hook for tests and process termination
export async function closeDbConnection(): Promise<void> {
  await queryClient.end();
}
