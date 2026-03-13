CREATE TYPE "public"."customer_app_notification_status" AS ENUM('pending', 'sent', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."customer_app_notification_type" AS ENUM('buy_token_nudge', 'failed_purchase_follow_up');--> statement-breakpoint
CREATE TABLE "customer_app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "customer_app_notification_type" NOT NULL,
	"status" "customer_app_notification_status" DEFAULT 'pending' NOT NULL,
	"phone_number" text NOT NULL,
	"meter_number" text NOT NULL,
	"reference_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone
);
