CREATE TYPE "public"."tenant_app_access_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "tenant_app_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" uuid NOT NULL,
	"access_token_hash" text NOT NULL,
	"status" "tenant_app_access_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "tenant_app_accesses_access_token_hash_unique" UNIQUE("access_token_hash")
);
--> statement-breakpoint
ALTER TABLE "customer_app_notifications" ALTER COLUMN "phone_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_device_tokens" ALTER COLUMN "phone_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_app_notifications" ADD COLUMN "tenant_access_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_device_tokens" ADD COLUMN "tenant_access_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_app_accesses" ADD CONSTRAINT "tenant_app_accesses_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_app_notifications" ADD CONSTRAINT "customer_app_notifications_tenant_access_id_tenant_app_accesses_id_fk" FOREIGN KEY ("tenant_access_id") REFERENCES "public"."tenant_app_accesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_device_tokens" ADD CONSTRAINT "customer_device_tokens_tenant_access_id_tenant_app_accesses_id_fk" FOREIGN KEY ("tenant_access_id") REFERENCES "public"."tenant_app_accesses"("id") ON DELETE cascade ON UPDATE no action;