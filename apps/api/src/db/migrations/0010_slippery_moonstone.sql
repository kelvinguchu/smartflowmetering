ALTER TABLE "customer_app_notifications" ADD COLUMN "delivery_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_app_notifications" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_app_notifications" ADD COLUMN "last_failure_code" text;--> statement-breakpoint
ALTER TABLE "customer_app_notifications" ADD COLUMN "last_failure_message" text;