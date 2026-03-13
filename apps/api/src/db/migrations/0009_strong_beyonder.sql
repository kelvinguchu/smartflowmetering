CREATE TYPE "public"."customer_device_platform" AS ENUM('android', 'ios', 'web');--> statement-breakpoint
CREATE TYPE "public"."customer_device_token_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "customer_device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"token" text NOT NULL,
	"platform" "customer_device_platform" NOT NULL,
	"status" "customer_device_token_status" DEFAULT 'active' NOT NULL,
	"invalidated_at" timestamp with time zone,
	"invalidation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_device_tokens_token_unique" UNIQUE("token")
);
