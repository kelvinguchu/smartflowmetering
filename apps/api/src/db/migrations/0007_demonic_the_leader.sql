ALTER TABLE "sms_logs" ADD COLUMN "provider_status" text;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD COLUMN "provider_error_code" text;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD COLUMN "provider_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD COLUMN "provider_delivered_at" timestamp with time zone;