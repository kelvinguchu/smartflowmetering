ALTER TABLE "user" ADD COLUMN "phone_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone_number_verified" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "preferred_two_factor_method" text DEFAULT 'sms' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "totp_enrollment_prompt_pending" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_phone_number_unique" UNIQUE("phone_number");