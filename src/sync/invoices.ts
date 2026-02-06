import { and, desc, eq } from "drizzle-orm";
import type { RubicClient } from "@/clients/rubic";
import type { TripletexClient } from "@/clients/tripletex";
import type { db } from "@/db/client";
import {
	type TripletexEnv,
	customerMapping,
	invoiceMapping,
	productMapping,
	syncState,
} from "@/db/schema";
import { logger } from "@/logger";
import { mapRubicInvoiceToTripletexOrder } from "@/mappers/invoice.mapper";

/**
 * Syncs invoices from Rubic to Tripletex.
 * - Gets last sync timestamp from sync_state table
 * - Fetches invoices from Rubic since last sync (or all if first run)
 * - Loads customer_mapping and product_mapping from DB (filtered by env)
 * - For each invoice:
 *   - Checks if already synced (exists in invoice_mapping for this env)
 *   - If not synced: looks up customer and products, creates Order then Invoice
 *   - Stores mapping in invoice_mapping table
 * - Updates sync_state table at start and end
 *
 * @returns Object with processed and failed counts
 */
export async function syncInvoices(
	rubicClient: RubicClient,
	tripletexClient: TripletexClient,
	dbInstance: typeof db,
	tripletexEnv: TripletexEnv = "production",
): Promise<{ processed: number; failed: number }> {
	logger.info("Starting invoice sync", "sync-invoices", { tripletexEnv });

	// Create sync state entry
	const [syncStateEntry] = await dbInstance
		.insert(syncState)
		.values({
			syncType: "invoices",
			tripletexEnv,
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
		// Get last sync timestamp (most recent successful sync for this env)
		const [lastSyncState] = await dbInstance
			.select()
			.from(syncState)
			.where(
				and(
					eq(syncState.syncType, "invoices"),
					eq(syncState.tripletexEnv, tripletexEnv),
				),
			)
			.orderBy(desc(syncState.lastSyncAt))
			.limit(1);

		const startPeriod = lastSyncState?.lastSyncAt ? new Date(lastSyncState.lastSyncAt) : undefined;
		const endPeriod = new Date();

		logger.info("Fetching invoices from Rubic", "sync-invoices", {
			startPeriod: startPeriod?.toISOString(),
			endPeriod: endPeriod.toISOString(),
			tripletexEnv,
		});

		// Fetch invoices from Rubic
		const rubicInvoices = await rubicClient.getInvoices(startPeriod, endPeriod);
		logger.info(`Fetched ${rubicInvoices.length} invoices from Rubic`, "sync-invoices", {
			count: rubicInvoices.length,
			tripletexEnv,
		});

		// Load customer mappings for this environment
		const customerMappings = await dbInstance
			.select()
			.from(customerMapping)
			.where(eq(customerMapping.tripletexEnv, tripletexEnv));
		const customerMap = new Map<string, number>();
		for (const mapping of customerMappings) {
			customerMap.set(mapping.rubicCustomerNo, mapping.tripletexCustomerId);
		}
		logger.info(`Loaded ${customerMap.size} customer mappings`, "sync-invoices", {
			tripletexEnv,
		});

		// Load product mappings for this environment
		const productMappings = await dbInstance
			.select()
			.from(productMapping)
			.where(eq(productMapping.tripletexEnv, tripletexEnv));
		const productMap = new Map<string, number>();
		for (const mapping of productMappings) {
			productMap.set(mapping.rubicProductCode, mapping.tripletexProductId);
		}
		logger.info(`Loaded ${productMap.size} product mappings`, "sync-invoices", {
			tripletexEnv,
		});

		// Check which invoices are already synced for this environment
		const existingInvoiceMappings = await dbInstance
			.select()
			.from(invoiceMapping)
			.where(eq(invoiceMapping.tripletexEnv, tripletexEnv));
		const syncedInvoiceIds = new Set(existingInvoiceMappings.map((m) => m.rubicInvoiceId));

		// Process each invoice
		for (const invoice of rubicInvoices) {
			try {
				// Skip if already synced
				if (syncedInvoiceIds.has(invoice.invoiceID)) {
					logger.debug(`Skipping invoice ${invoice.invoiceID} (already synced)`, "sync-invoices", {
						rubicInvoiceId: invoice.invoiceID,
						rubicInvoiceNumber: invoice.invoiceNumber,
						tripletexEnv,
					});
					processed++;
					continue;
				}

				// Look up customer
				const customerNo = invoice.customer.customerNo;
				if (!customerNo) {
					logger.warn(
						`Skipping invoice ${invoice.invoiceID} (no customer number)`,
						"sync-invoices",
						{
							rubicInvoiceId: invoice.invoiceID,
							rubicInvoiceNumber: invoice.invoiceNumber,
							tripletexEnv,
						},
					);
					failed++;
					continue;
				}

				const tripletexCustomerId = customerMap.get(customerNo);
				if (!tripletexCustomerId) {
					logger.warn(
						`Skipping invoice ${invoice.invoiceID} (customer ${customerNo} not mapped)`,
						"sync-invoices",
						{
							rubicInvoiceId: invoice.invoiceID,
							rubicInvoiceNumber: invoice.invoiceNumber,
							customerNo,
							tripletexEnv,
						},
					);
					failed++;
					continue;
				}

				// Check if invoice has lines with valid product mappings
				if (!invoice.invoiceLines || invoice.invoiceLines.length === 0) {
					logger.warn(`Skipping invoice ${invoice.invoiceID} (no invoice lines)`, "sync-invoices", {
						rubicInvoiceId: invoice.invoiceID,
						rubicInvoiceNumber: invoice.invoiceNumber,
						tripletexEnv,
					});
					failed++;
					continue;
				}

				// Filter lines that have valid product mappings
				const validLines = invoice.invoiceLines.filter(
					(line) => line.productCode && productMap.has(line.productCode),
				);

				if (validLines.length === 0) {
					logger.warn(
						`Skipping invoice ${invoice.invoiceID} (no valid product mappings)`,
						"sync-invoices",
						{
							rubicInvoiceId: invoice.invoiceID,
							rubicInvoiceNumber: invoice.invoiceNumber,
							tripletexEnv,
						},
					);
					failed++;
					continue;
				}

				// Map invoice to order
				const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMap);

				// Create order in Tripletex
				logger.info(`Creating order for invoice ${invoice.invoiceID}`, "sync-invoices", {
					rubicInvoiceId: invoice.invoiceID,
					rubicInvoiceNumber: invoice.invoiceNumber,
					tripletexCustomerId,
					orderLinesCount: order.orderLines?.length ?? 0,
					tripletexEnv,
				});

				const orderResponse = await tripletexClient.createOrder(order);
				if (!orderResponse.value.id) {
					throw new Error("Failed to create order: no ID returned");
				}

				const orderId = orderResponse.value.id;

				// Create invoice from order
				logger.info(`Creating invoice from order ${orderId}`, "sync-invoices", {
					rubicInvoiceId: invoice.invoiceID,
					rubicInvoiceNumber: invoice.invoiceNumber,
					orderId,
					tripletexEnv,
				});

				const invoiceResponse = await tripletexClient.createInvoiceFromOrder(
					orderId,
					invoice.invoiceDate,
				);

				if (!invoiceResponse.value.id) {
					throw new Error("Failed to create invoice: no ID returned");
				}

				const tripletexInvoiceId = invoiceResponse.value.id;

				// Store mapping
				await dbInstance.insert(invoiceMapping).values({
					rubicInvoiceId: invoice.invoiceID,
					tripletexEnv,
					rubicInvoiceNumber: invoice.invoiceNumber,
					tripletexInvoiceId,
					lastSyncedAt: new Date(),
					paymentSynced: false,
				});

				logger.info(`Successfully synced invoice ${invoice.invoiceID}`, "sync-invoices", {
					rubicInvoiceId: invoice.invoiceID,
					rubicInvoiceNumber: invoice.invoiceNumber,
					tripletexInvoiceId,
					orderId,
					tripletexEnv,
				});

				processed++;
			} catch (error) {
				failed++;
				logger.error(`Failed to sync invoice ${invoice.invoiceID}`, "sync-invoices", {
					rubicInvoiceId: invoice.invoiceID,
					rubicInvoiceNumber: invoice.invoiceNumber,
					tripletexEnv,
					error: error instanceof Error ? error.message : String(error),
				});
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

		logger.info("Invoice sync completed", "sync-invoices", {
			processed,
			failed,
			tripletexEnv,
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

		logger.error("Invoice sync failed", "sync-invoices", {
			error: error instanceof Error ? error.message : String(error),
			tripletexEnv,
		});

		throw error;
	}
}
