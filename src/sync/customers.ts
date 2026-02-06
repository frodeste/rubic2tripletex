import { eq } from "drizzle-orm";
import type { RubicClient } from "@/clients/rubic";
import type { TripletexClient } from "@/clients/tripletex";
import type { db } from "@/db/client";
import { customerMapping, syncState } from "@/db/schema";
import { logger } from "@/logger";
import { computeCustomerHash, mapRubicCustomerToTripletex } from "@/mappers/customer.mapper";

/**
 * Syncs customers from Rubic to Tripletex.
 *
 * For each customer with a valid customerNo:
 * - Computes hash and checks against customer_mapping table
 * - If no mapping exists: searches Tripletex by customer number, creates if not found
 * - If mapping exists but hash changed: updates in Tripletex
 * - If hash unchanged: skips
 * - Updates customer_mapping table with tripletex ID and new hash
 *
 * @returns Object with processed and failed counts
 */
export async function syncCustomers(
	rubicClient: RubicClient,
	tripletexClient: TripletexClient,
	dbInstance: typeof db,
): Promise<{ processed: number; failed: number }> {
	let processed = 0;
	let failed = 0;
	let syncStateId: number | null = null;

	try {
		// Create sync_state entry
		const [syncStateRecord] = await dbInstance
			.insert(syncState)
			.values({
				syncType: "customers",
				status: "running",
				recordsProcessed: 0,
				recordsFailed: 0,
			})
			.returning();

		syncStateId = syncStateRecord.id;

		logger.info("Starting customer sync", "syncCustomers", {
			syncStateId,
		});

		// Fetch all customers from Rubic
		const rubicCustomers = await rubicClient.getCustomers();
		logger.info(`Fetched ${rubicCustomers.length} customers from Rubic`, "syncCustomers");

		// Process each customer
		for (const rubicCustomer of rubicCustomers) {
			// Skip customers without a valid customerNo
			if (!rubicCustomer.customerNo) {
				logger.debug("Skipping customer without customerNo", "syncCustomers", {
					customerName: rubicCustomer.customerName,
				});
				continue;
			}

			try {
				const customerNo = rubicCustomer.customerNo;
				const newHash = computeCustomerHash(rubicCustomer);

				// Check existing mapping
				const [existingMapping] = await dbInstance
					.select()
					.from(customerMapping)
					.where(eq(customerMapping.rubicCustomerNo, customerNo))
					.limit(1);

				let tripletexCustomerId: number;

				if (existingMapping) {
					// Check if hash changed
					if (existingMapping.hash === newHash) {
						logger.debug("Customer unchanged, skipping", "syncCustomers", {
							customerNo,
							tripletexCustomerId: existingMapping.tripletexCustomerId,
						});
						processed++;
						continue;
					}

					// Hash changed, update existing customer
					tripletexCustomerId = existingMapping.tripletexCustomerId;
					const tripletexCustomer = mapRubicCustomerToTripletex(rubicCustomer);

					// Fetch current customer to get version for optimistic locking
					// Search by customer number if available
					let existingCustomer: Awaited<ReturnType<typeof tripletexClient.getCustomerByNumber>> =
						null;
					const customerNumber = Number.parseInt(customerNo, 10);
					if (!Number.isNaN(customerNumber)) {
						existingCustomer = await tripletexClient.getCustomerByNumber(customerNumber);
					}

					// If found by number and matches our ID, use its version; otherwise use the ID from mapping
					if (existingCustomer?.id === tripletexCustomerId && existingCustomer.version) {
						tripletexCustomer.id = existingCustomer.id;
						tripletexCustomer.version = existingCustomer.version;
					} else {
						// Fallback: set ID and let Tripletex handle version
						tripletexCustomer.id = tripletexCustomerId;
					}

					await tripletexClient.updateCustomer(tripletexCustomerId, tripletexCustomer);
					logger.info("Updated customer in Tripletex", "syncCustomers", {
						customerNo,
						tripletexCustomerId,
					});
				} else {
					// No mapping exists, search or create
					const customerNumber = Number.parseInt(customerNo, 10);
					let existingTripletexCustomer: Awaited<
						ReturnType<typeof tripletexClient.getCustomerByNumber>
					> = null;

					if (!Number.isNaN(customerNumber)) {
						existingTripletexCustomer = await tripletexClient.getCustomerByNumber(customerNumber);
					}

					if (existingTripletexCustomer?.id) {
						// Found existing customer in Tripletex
						tripletexCustomerId = existingTripletexCustomer.id;
						logger.info("Found existing customer in Tripletex", "syncCustomers", {
							customerNo,
							tripletexCustomerId,
						});
					} else {
						// Create new customer
						const tripletexCustomer = mapRubicCustomerToTripletex(rubicCustomer);
						const createResponse = await tripletexClient.createCustomer(tripletexCustomer);
						if (!createResponse.value.id) {
							throw new Error("Failed to create customer: no ID returned");
						}
						tripletexCustomerId = createResponse.value.id;
						logger.info("Created new customer in Tripletex", "syncCustomers", {
							customerNo,
							tripletexCustomerId,
						});
					}
				}

				// Update or insert mapping
				await dbInstance
					.insert(customerMapping)
					.values({
						rubicCustomerNo: customerNo,
						tripletexCustomerId,
						hash: newHash,
					})
					.onConflictDoUpdate({
						target: customerMapping.rubicCustomerNo,
						set: {
							tripletexCustomerId,
							hash: newHash,
							lastSyncedAt: new Date(),
						},
					});

				processed++;
			} catch (error) {
				failed++;
				logger.error("Failed to sync customer", "syncCustomers", {
					customerNo: rubicCustomer.customerNo,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Update sync_state to success
		if (syncStateId !== null) {
			await dbInstance
				.update(syncState)
				.set({
					status: "success",
					recordsProcessed: processed,
					recordsFailed: failed,
					completedAt: new Date(),
					lastSyncAt: new Date(),
				})
				.where(eq(syncState.id, syncStateId));
		}

		logger.info("Customer sync completed", "syncCustomers", {
			processed,
			failed,
		});

		return { processed, failed };
	} catch (error) {
		// Update sync_state to failed
		if (syncStateId !== null) {
			await dbInstance
				.update(syncState)
				.set({
					status: "failed",
					recordsProcessed: processed,
					recordsFailed: failed,
					completedAt: new Date(),
					errorMessage: error instanceof Error ? error.message : String(error),
				})
				.where(eq(syncState.id, syncStateId));
		}

		logger.error("Customer sync failed", "syncCustomers", {
			error: error instanceof Error ? error.message : String(error),
			processed,
			failed,
		});

		throw error;
	}
}
