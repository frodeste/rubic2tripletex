import { and, desc, eq } from "drizzle-orm";
import type { RubicClient } from "@/clients/rubic";
import type { TripletexClient } from "@/clients/tripletex";
import type { db } from "@/db/client";
import { invoiceMapping, syncState } from "@/db/schema";
import { logger } from "@/logger";
import type { RubicInvoiceTransaction } from "@/types/rubic";
import type { TripletexPayment } from "@/types/tripletex";

/**
 * Syncs payments from Rubic invoice transactions to Tripletex.
 * - Gets last sync timestamp from sync_state table for type 'payments'
 * - Fetches invoice transactions from Rubic since last sync
 * - For each transaction:
 *   - Looks up corresponding Tripletex invoice ID from invoice_mapping table
 *   - Skips if no mapping found (invoice hasn't been synced yet)
 *   - Skips if paymentSynced is already true
 *   - Registers payment in Tripletex
 *   - Updates invoice_mapping.paymentSynced = true
 * - Updates sync_state table at start and end
 */
export async function syncPayments(
	rubicClient: RubicClient,
	tripletexClient: TripletexClient,
	dbInstance: typeof db,
): Promise<{ processed: number; failed: number }> {
	logger.info("Starting payment sync", "sync-payments");

	// Get last sync timestamp
	const [lastSyncState] = await dbInstance
		.select()
		.from(syncState)
		.where(and(eq(syncState.syncType, "payments"), eq(syncState.status, "success")))
		.orderBy(desc(syncState.completedAt))
		.limit(1);

	const startPeriod = lastSyncState?.lastSyncAt || undefined;
	const endPeriod = new Date();

	logger.info("Fetching invoice transactions from Rubic", "sync-payments", {
		startPeriod: startPeriod?.toISOString(),
		endPeriod: endPeriod.toISOString(),
	});

	// Create sync state entry
	const [syncStateEntry] = await dbInstance
		.insert(syncState)
		.values({
			syncType: "payments",
			status: "running",
			recordsProcessed: 0,
			recordsFailed: 0,
		})
		.returning();

	if (!syncStateEntry) {
		throw new Error("Failed to create sync state entry");
	}

	let processed = 0;
	let failed = 0;

	try {
		// Fetch invoice transactions from Rubic
		const transactions = await rubicClient.getInvoiceTransactions(startPeriod, endPeriod);
		logger.info(`Fetched ${transactions.length} invoice transactions from Rubic`, "sync-payments", {
			count: transactions.length,
		});

		// Process each transaction
		for (const transaction of transactions) {
			try {
				const wasProcessed = await processTransaction(transaction, tripletexClient, dbInstance);
				if (wasProcessed) {
					processed++;
				}
			} catch (error) {
				failed++;
				logger.error(
					`Failed to sync payment for transaction ${transaction.invoiceTransactionID}`,
					"sync-payments",
					{
						invoiceTransactionID: transaction.invoiceTransactionID,
						invoiceID: transaction.invoiceID,
						error: error instanceof Error ? error.message : String(error),
					},
				);
			}
		}

		// Update sync state to success
		await dbInstance
			.update(syncState)
			.set({
				status: "success",
				recordsProcessed: processed,
				recordsFailed: failed,
				completedAt: new Date(),
				lastSyncAt: new Date(),
			})
			.where(eq(syncState.id, syncStateEntry.id));

		logger.info("Payment sync completed", "sync-payments", {
			processed,
			failed,
		});

		return { processed, failed };
	} catch (error) {
		// Update sync state to failed
		await dbInstance
			.update(syncState)
			.set({
				status: "failed",
				recordsProcessed: processed,
				recordsFailed: failed,
				errorMessage: error instanceof Error ? error.message : String(error),
				completedAt: new Date(),
			})
			.where(eq(syncState.id, syncStateEntry.id));

		logger.error("Payment sync failed", "sync-payments", {
			error: error instanceof Error ? error.message : String(error),
		});

		throw error;
	}
}

/**
 * Processes a single transaction: looks up invoice mapping, registers payment if needed.
 * Returns true if payment was actually processed, false if skipped.
 */
async function processTransaction(
	transaction: RubicInvoiceTransaction,
	tripletexClient: TripletexClient,
	dbInstance: typeof db,
): Promise<boolean> {
	// Look up invoice mapping
	const [mapping] = await dbInstance
		.select()
		.from(invoiceMapping)
		.where(eq(invoiceMapping.rubicInvoiceId, transaction.invoiceID))
		.limit(1);

	if (!mapping) {
		// No mapping found, skip (invoice hasn't been synced yet)
		logger.debug(
			`Skipping transaction ${transaction.invoiceTransactionID} - no invoice mapping found`,
			"sync-payments",
			{
				invoiceTransactionID: transaction.invoiceTransactionID,
				rubicInvoiceId: transaction.invoiceID,
			},
		);
		return false;
	}

	// Check if payment already synced
	if (mapping.paymentSynced) {
		logger.debug(
			`Skipping transaction ${transaction.invoiceTransactionID} - payment already synced`,
			"sync-payments",
			{
				invoiceTransactionID: transaction.invoiceTransactionID,
				rubicInvoiceId: transaction.invoiceID,
			},
		);
		return false;
	}

	// Register payment in Tripletex
	logger.info(
		`Registering payment for invoice ${transaction.invoiceID} in Tripletex`,
		"sync-payments",
		{
			invoiceTransactionID: transaction.invoiceTransactionID,
			rubicInvoiceId: transaction.invoiceID,
			tripletexInvoiceId: mapping.tripletexInvoiceId,
			amount: transaction.paidAmount,
			paymentDate: transaction.paymentDate,
		},
	);

	const payment: TripletexPayment = {
		amount: transaction.paidAmount,
		paymentDate: transaction.paymentDate,
	};

	await tripletexClient.registerPayment(mapping.tripletexInvoiceId, payment);

	// Update invoice_mapping.paymentSynced = true
	await dbInstance
		.update(invoiceMapping)
		.set({
			paymentSynced: true,
		})
		.where(eq(invoiceMapping.rubicInvoiceId, transaction.invoiceID));

	logger.info(
		`Successfully registered payment for invoice ${transaction.invoiceID}`,
		"sync-payments",
		{
			invoiceTransactionID: transaction.invoiceTransactionID,
			rubicInvoiceId: transaction.invoiceID,
			tripletexInvoiceId: mapping.tripletexInvoiceId,
		},
	);

	return true;
}
