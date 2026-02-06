import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

// --- Enums ---

export const syncTypeEnum = pgEnum("sync_type", ["customers", "products", "invoices", "payments"]);

export const syncStatusEnum = pgEnum("sync_status", ["running", "success", "failed"]);

// --- Sync State ---

export const syncState = pgTable("sync_state", {
	id: serial("id").primaryKey(),
	syncType: syncTypeEnum("sync_type").notNull(),
	lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
	status: syncStatusEnum("status").notNull().default("running"),
	errorMessage: text("error_message"),
	recordsProcessed: integer("records_processed").default(0),
	recordsFailed: integer("records_failed").default(0),
	startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true }),
});

// --- Customer Mapping ---

export const customerMapping = pgTable("customer_mapping", {
	rubicCustomerNo: varchar("rubic_customer_no", { length: 50 }).primaryKey(),
	tripletexCustomerId: integer("tripletex_customer_id").notNull(),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
	hash: varchar("hash", { length: 64 }),
});

// --- Product Mapping ---

export const productMapping = pgTable("product_mapping", {
	rubicProductCode: varchar("rubic_product_code", { length: 100 }).primaryKey(),
	tripletexProductId: integer("tripletex_product_id").notNull(),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
	hash: varchar("hash", { length: 64 }),
});

// --- Invoice Mapping ---

export const invoiceMapping = pgTable("invoice_mapping", {
	rubicInvoiceId: integer("rubic_invoice_id").primaryKey(),
	rubicInvoiceNumber: integer("rubic_invoice_number").notNull(),
	tripletexInvoiceId: integer("tripletex_invoice_id").notNull(),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
	paymentSynced: boolean("payment_synced").notNull().default(false),
});
