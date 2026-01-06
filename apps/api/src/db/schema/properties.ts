import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customers";

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  landlordId: uuid("landlord_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  name: text("name").notNull(), // e.g., 'Sunrise Apartments'
  location: text("location").notNull(),
  numberOfUnits: integer("number_of_units").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  landlord: one(customers, {
    fields: [properties.landlordId],
    references: [customers.id],
  }),
  motherMeters: many(properties), // Will be linked in index.ts
}));

// Types
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
