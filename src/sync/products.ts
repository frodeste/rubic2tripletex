import { eq } from "drizzle-orm";
import type { RubicClient } from "@/clients/rubic";
import type { TripletexClient } from "@/clients/tripletex";
import type { db } from "@/db/client";
import { productMapping, syncState } from "@/db/schema";
import { logger } from "@/logger";
import { computeProductHash, mapRubicProductToTripletex } from "@/mappers/product.mapper";
import type { RubicProduct } from "@/types/rubic";

/**
 * Syncs products from Rubic to Tripletex.
 * - Fetches all products from Rubic
 * - For each product with a valid productCode:
 *   - Checks if mapping exists and if hash changed
 *   - Creates or updates product in Tripletex as needed
 *   - Updates product_mapping table
 * - Updates sync_state table at start and end
 */
export async function syncProducts(
	rubicClient: RubicClient,
	tripletexClient: TripletexClient,
	dbInstance: typeof db,
): Promise<{ processed: number; failed: number }> {
	logger.info("Starting product sync", "sync-products");

	// Create sync state entry
	const [syncStateEntry] = await dbInstance
		.insert(syncState)
		.values({
			syncType: "products",
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
		// Fetch all products from Rubic
		logger.info("Fetching products from Rubic", "sync-products");
		const rubicProducts = await rubicClient.getProducts();
		logger.info(`Fetched ${rubicProducts.length} products from Rubic`, "sync-products", {
			count: rubicProducts.length,
		});

		// Filter products with valid productCode
		const validProducts = rubicProducts.filter(
			(p) => p.productCode !== null && p.productCode !== undefined && p.productCode.trim() !== "",
		);

		logger.info(
			`Processing ${validProducts.length} products with valid productCode`,
			"sync-products",
			{
				validCount: validProducts.length,
				totalCount: rubicProducts.length,
			},
		);

		// Process each product
		for (const rubicProduct of validProducts) {
			try {
				await processProduct(rubicProduct, tripletexClient, dbInstance);
				processed++;
			} catch (error) {
				failed++;
				logger.error(`Failed to sync product ${rubicProduct.productCode}`, "sync-products", {
					productCode: rubicProduct.productCode,
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

		logger.info("Product sync completed", "sync-products", {
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

		logger.error("Product sync failed", "sync-products", {
			error: error instanceof Error ? error.message : String(error),
		});

		throw error;
	}
}

/**
 * Processes a single product: checks mapping, creates/updates in Tripletex, updates mapping.
 */
async function processProduct(
	rubicProduct: RubicProduct,
	tripletexClient: TripletexClient,
	dbInstance: typeof db,
): Promise<void> {
	// This function is only called with products that have valid productCode
	// (filtered before calling), but TypeScript doesn't know that
	const productCode = rubicProduct.productCode ?? "";
	if (!productCode) {
		throw new Error("Product code is required");
	}
	const hash = computeProductHash(rubicProduct);

	// Check if mapping exists
	const [existingMapping] = await dbInstance
		.select()
		.from(productMapping)
		.where(eq(productMapping.rubicProductCode, productCode))
		.limit(1);

	if (existingMapping) {
		// Check if hash changed
		if (existingMapping.hash === hash) {
			// Hash unchanged, skip
			logger.debug(`Skipping product ${productCode} (no changes)`, "sync-products", {
				productCode,
			});
			return;
		}

		// Hash changed, update product in Tripletex
		logger.info(`Updating product ${productCode} in Tripletex`, "sync-products", {
			productCode,
			tripletexProductId: existingMapping.tripletexProductId,
		});

		const tripletexProduct = mapRubicProductToTripletex(rubicProduct);
		// Include version and id for update
		const updatePayload: typeof tripletexProduct & { id: number; version?: number } = {
			...tripletexProduct,
			id: existingMapping.tripletexProductId,
		};

		await tripletexClient.updateProduct(existingMapping.tripletexProductId, updatePayload);

		// Update mapping with new hash
		await dbInstance
			.update(productMapping)
			.set({
				hash,
				lastSyncedAt: new Date(),
			})
			.where(eq(productMapping.rubicProductCode, productCode));
	} else {
		// No mapping exists, search Tripletex by product number
		logger.info(`Searching for product ${productCode} in Tripletex`, "sync-products", {
			productCode,
		});

		let tripletexProductId: number;

		const existingTripletexProduct = await tripletexClient.getProductByNumber(productCode);
		if (existingTripletexProduct?.id) {
			// Product exists in Tripletex, use its ID
			tripletexProductId = existingTripletexProduct.id;
			logger.info(`Found existing product ${productCode} in Tripletex`, "sync-products", {
				productCode,
				tripletexProductId,
			});

			// Update the existing product
			const tripletexProduct = mapRubicProductToTripletex(rubicProduct);
			const updatePayload: typeof tripletexProduct & { id: number; version?: number } = {
				...tripletexProduct,
				id: tripletexProductId,
				version: existingTripletexProduct.version,
			};

			await tripletexClient.updateProduct(tripletexProductId, updatePayload);
		} else {
			// Product doesn't exist, create it
			logger.info(`Creating product ${productCode} in Tripletex`, "sync-products", {
				productCode,
			});

			const tripletexProduct = mapRubicProductToTripletex(rubicProduct);
			const createResponse = await tripletexClient.createProduct(tripletexProduct);
			if (!createResponse.value.id) {
				throw new Error("Failed to create product: no ID returned");
			}
			tripletexProductId = createResponse.value.id;

			logger.info(`Created product ${productCode} in Tripletex`, "sync-products", {
				productCode,
				tripletexProductId,
			});
		}

		// Create mapping
		await dbInstance.insert(productMapping).values({
			rubicProductCode: productCode,
			tripletexProductId,
			hash,
			lastSyncedAt: new Date(),
		});
	}
}
