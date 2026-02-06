CREATE TYPE "public"."sync_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sync_type" AS ENUM('customers', 'products', 'invoices', 'payments');--> statement-breakpoint
CREATE TABLE "customer_mapping" (
	"rubic_customer_no" varchar(50) PRIMARY KEY NOT NULL,
	"tripletex_customer_id" integer NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hash" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "invoice_mapping" (
	"rubic_invoice_id" integer PRIMARY KEY NOT NULL,
	"rubic_invoice_number" integer NOT NULL,
	"tripletex_invoice_id" integer NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_synced" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_mapping" (
	"rubic_product_code" varchar(100) PRIMARY KEY NOT NULL,
	"tripletex_product_id" integer NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hash" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_type" "sync_type" NOT NULL,
	"last_sync_at" timestamp with time zone,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"error_message" text,
	"records_processed" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
