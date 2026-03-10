CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."bill_payer" AS ENUM('kplc', 'landlord');--> statement-breakpoint
CREATE TYPE "public"."building_type" AS ENUM('residential', 'commercial', 'industrial');--> statement-breakpoint
CREATE TYPE "public"."customer_type" AS ENUM('tenant', 'landlord');--> statement-breakpoint
CREATE TYPE "public"."failed_transaction_status" AS ENUM('pending_review', 'refunded', 'resolved', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."failure_reason" AS ENUM('invalid_meter', 'below_minimum', 'manufacturer_error', 'sms_failed', 'meter_inactive', 'other');--> statement-breakpoint
CREATE TYPE "public"."generated_by" AS ENUM('system', 'admin', 'landlord');--> statement-breakpoint
CREATE TYPE "public"."installation_type" AS ENUM('new', 'existing');--> statement-breakpoint
CREATE TYPE "public"."meter_brand" AS ENUM('hexing', 'stron', 'conlog');--> statement-breakpoint
CREATE TYPE "public"."meter_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."meter_type" AS ENUM('electricity', 'water', 'gas');--> statement-breakpoint
CREATE TYPE "public"."mother_meter_event_type" AS ENUM('initial_deposit', 'refill', 'bill_payment');--> statement-breakpoint
CREATE TYPE "public"."mother_meter_type" AS ENUM('prepaid', 'postpaid');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('paybill', 'stk_push', 'ussd');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('prepaid', 'postpaid');--> statement-breakpoint
CREATE TYPE "public"."sms_provider" AS ENUM('africastalking', 'hostpinnacle');--> statement-breakpoint
CREATE TYPE "public"."sms_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."token_type" AS ENUM('credit', 'clear_tamper', 'set_power_limit', 'key_change', 'clear_credit');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."utility_type" AS ENUM('electricity', 'water');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone_number" text NOT NULL,
	"name" text NOT NULL,
	"customer_type" "customer_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "failed_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mpesa_transaction_id" uuid NOT NULL,
	"failure_reason" "failure_reason" NOT NULL,
	"failure_details" text,
	"meter_number_attempted" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"phone_number" text NOT NULL,
	"status" "failed_transaction_status" DEFAULT 'pending_review' NOT NULL,
	"resolved_by" uuid,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "generated_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" uuid NOT NULL,
	"transaction_id" uuid,
	"token" text NOT NULL,
	"token_type" "token_type" NOT NULL,
	"value" numeric(12, 4),
	"generated_by" "generated_by" DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meter_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone_number" text NOT NULL,
	"email" text NOT NULL,
	"id_number" text NOT NULL,
	"kra_pin" text NOT NULL,
	"county" text NOT NULL,
	"location" text NOT NULL,
	"building_type" "building_type" NOT NULL,
	"utility_type" "utility_type" NOT NULL,
	"mother_meter_number" text NOT NULL,
	"initial_reading" numeric(12, 2),
	"payment_mode" "payment_mode" NOT NULL,
	"sub_meter_numbers" jsonb NOT NULL,
	"installation_type" "installation_type" NOT NULL,
	"supplies_other_houses" boolean DEFAULT false NOT NULL,
	"bill_payer" "bill_payer" NOT NULL,
	"technician_name" text,
	"technician_phone" text,
	"terms_accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_number" text NOT NULL,
	"meter_type" "meter_type" NOT NULL,
	"brand" "meter_brand" NOT NULL,
	"mother_meter_id" uuid NOT NULL,
	"tariff_id" uuid NOT NULL,
	"supply_group_code" text NOT NULL,
	"key_revision_number" integer DEFAULT 1 NOT NULL,
	"tariff_index" integer DEFAULT 1 NOT NULL,
	"status" "meter_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meters_meter_number_unique" UNIQUE("meter_number")
);
--> statement-breakpoint
CREATE TABLE "mother_meter_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mother_meter_id" uuid NOT NULL,
	"event_type" "mother_meter_event_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"kplc_token" text,
	"kplc_receipt_number" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mother_meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mother_meter_number" text NOT NULL,
	"type" "mother_meter_type" NOT NULL,
	"landlord_id" uuid NOT NULL,
	"tariff_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"total_capacity" numeric(10, 2),
	"low_balance_threshold" numeric(10, 2) DEFAULT '1000' NOT NULL,
	"billing_period_start" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mother_meters_mother_meter_number_unique" UNIQUE("mother_meter_number")
);
--> statement-breakpoint
CREATE TABLE "mpesa_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_type" text NOT NULL,
	"trans_id" text NOT NULL,
	"trans_time" text NOT NULL,
	"trans_amount" numeric(12, 2) NOT NULL,
	"business_short_code" text NOT NULL,
	"bill_ref_number" text NOT NULL,
	"invoice_number" text,
	"org_account_balance" numeric(14, 2),
	"third_party_trans_id" text,
	"msisdn" text NOT NULL,
	"first_name" text,
	"middle_name" text,
	"last_name" text,
	"raw_callback_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mpesa_transactions_trans_id_unique" UNIQUE("trans_id")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landlord_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"number_of_units" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid,
	"phone_number" text NOT NULL,
	"message_body" text NOT NULL,
	"provider" "sms_provider" NOT NULL,
	"status" "sms_status" DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"cost" numeric(8, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rate_per_kwh" numeric(10, 4) NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"meter_id" uuid NOT NULL,
	"mpesa_transaction_id" uuid,
	"phone_number" text NOT NULL,
	"mpesa_receipt_number" text NOT NULL,
	"amount_paid" numeric(12, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"net_amount" numeric(12, 2) NOT NULL,
	"rate_used" numeric(10, 4) NOT NULL,
	"units_purchased" numeric(12, 4) NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "transactions_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "transactions_mpesa_receipt_number_unique" UNIQUE("mpesa_receipt_number")
);
--> statement-breakpoint
ALTER TABLE "failed_transactions" ADD CONSTRAINT "failed_transactions_mpesa_transaction_id_mpesa_transactions_id_fk" FOREIGN KEY ("mpesa_transaction_id") REFERENCES "public"."mpesa_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_tokens" ADD CONSTRAINT "generated_tokens_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_tokens" ADD CONSTRAINT "generated_tokens_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meters" ADD CONSTRAINT "meters_mother_meter_id_mother_meters_id_fk" FOREIGN KEY ("mother_meter_id") REFERENCES "public"."mother_meters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meters" ADD CONSTRAINT "meters_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mother_meter_events" ADD CONSTRAINT "mother_meter_events_mother_meter_id_mother_meters_id_fk" FOREIGN KEY ("mother_meter_id") REFERENCES "public"."mother_meters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mother_meters" ADD CONSTRAINT "mother_meters_landlord_id_customers_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mother_meters" ADD CONSTRAINT "mother_meters_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mother_meters" ADD CONSTRAINT "mother_meters_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_landlord_id_customers_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_mpesa_transaction_id_mpesa_transactions_id_fk" FOREIGN KEY ("mpesa_transaction_id") REFERENCES "public"."mpesa_transactions"("id") ON DELETE restrict ON UPDATE no action;
