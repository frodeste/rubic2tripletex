-- Add tripletex_env enum type
CREATE TYPE "public"."tripletex_env" AS ENUM('sandbox', 'production');

-- Add tripletex_env column to sync_state (default to 'production' for existing rows)
ALTER TABLE "sync_state" ADD COLUMN "tripletex_env" "tripletex_env" NOT NULL DEFAULT 'production';

-- Add tripletex_env column to customer_mapping
ALTER TABLE "customer_mapping" ADD COLUMN "tripletex_env" "tripletex_env" NOT NULL DEFAULT 'production';

-- Drop old primary key and create composite PK for customer_mapping
ALTER TABLE "customer_mapping" DROP CONSTRAINT "customer_mapping_pkey";
ALTER TABLE "customer_mapping" ADD CONSTRAINT "customer_mapping_rubic_customer_no_tripletex_env_pk" PRIMARY KEY ("rubic_customer_no", "tripletex_env");

-- Add tripletex_env column to product_mapping
ALTER TABLE "product_mapping" ADD COLUMN "tripletex_env" "tripletex_env" NOT NULL DEFAULT 'production';

-- Drop old primary key and create composite PK for product_mapping
ALTER TABLE "product_mapping" DROP CONSTRAINT "product_mapping_pkey";
ALTER TABLE "product_mapping" ADD CONSTRAINT "product_mapping_rubic_product_code_tripletex_env_pk" PRIMARY KEY ("rubic_product_code", "tripletex_env");

-- Add tripletex_env column to invoice_mapping
ALTER TABLE "invoice_mapping" ADD COLUMN "tripletex_env" "tripletex_env" NOT NULL DEFAULT 'production';

-- Drop old primary key and create composite PK for invoice_mapping
ALTER TABLE "invoice_mapping" DROP CONSTRAINT "invoice_mapping_pkey";
ALTER TABLE "invoice_mapping" ADD CONSTRAINT "invoice_mapping_rubic_invoice_id_tripletex_env_pk" PRIMARY KEY ("rubic_invoice_id", "tripletex_env");
