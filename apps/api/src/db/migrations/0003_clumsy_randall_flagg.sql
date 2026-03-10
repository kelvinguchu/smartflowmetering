ALTER TABLE "failed_transactions" DROP CONSTRAINT IF EXISTS "failed_transactions_mpesa_transaction_id_mpesa_transactions_id_fk";
--> statement-breakpoint
ALTER TABLE "failed_transactions" DROP CONSTRAINT IF EXISTS "failed_transactions_mpesa_transaction_id_mpesa_transactions_id_";
--> statement-breakpoint
ALTER TABLE "failed_transactions" ADD CONSTRAINT "failed_tx_mpesa_tx_fk" FOREIGN KEY ("mpesa_transaction_id") REFERENCES "public"."mpesa_transactions"("id") ON DELETE restrict ON UPDATE no action;
