ALTER TABLE "transactions" ALTER COLUMN "payment_method" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."payment_method";--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('paybill', 'stk_push');--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "payment_method" SET DATA TYPE "public"."payment_method" USING "payment_method"::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "sms_logs" ALTER COLUMN "provider" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."sms_provider";--> statement-breakpoint
CREATE TYPE "public"."sms_provider" AS ENUM('hostpinnacle');--> statement-breakpoint
ALTER TABLE "sms_logs" ALTER COLUMN "provider" SET DATA TYPE "public"."sms_provider" USING "provider"::"public"."sms_provider";