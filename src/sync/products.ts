import { and, eq } from "drizzle-orm";
import type { RubicClient } from "@/clients/rubic";
import type { TripletexClient } from "@/clients/tripletex";
import type { db } from "@/db/client";
import { type TripletexEnv, productMapping, syncState } from "@/db/schema";
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
	tripletexEnv: TripletexEnv = "production",
): Promise<{ processed: number; failed: number }> {
	logger.info("Starting product sync", "sync-products", { tripletexEnv });

	// Create sync state entry
	const [syncStateEntry] = await dbInstance
		.insert(syncState)
		.values({
			syncType: "products",
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
		// Fetch all products from Rubic
		logger.info("Fetching products from Rubic", "sync-products", { tripletexEnv });
		const rubicProducts = await rubicClient.getProducts();
		logger.info(`Fetched ${rubicProducts.length} products from Rubic`, "sync-products", {
			count: rubicProducts.length,
			tripletexEnv,
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
				tripletexEnv,
			},
		);

		// Process each product
		for (const rubicProduct of validProducts) {
			try {
				await processProduct(rubicProduct, tripletexClient, dbInstance, tripletexEnv);
				processed++;
			} catch (error) {
				failed++;
				logger.error(`Failed to sync product ${rubicProduct.productCode}`, "sync-products", {
					productCode: rubicProduct.productCode,
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

		logger.info("Product sync completed", "sync-products", {
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

		logger.error("Product sync failed", "sync-products", {
			error: error instanceof Error ? error.message : String(error),
			tripletexEnv,
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
	tripletexEnv: TripletexEnv,
): Promise<void> {
	const productCode = rubicProduct.productCode ?? "";
	if (!productCode) {
		throw new Error("Product code is required");
	}
	const hash = computeProductHash(rubicProduct);

	// Check if mapping exists for this environment
	const [existingMapping] = await dbInstance
		.select()
		.from(productMapping)
		.where(
			and(
				eq(productMapping.rubicProductCode, productCode),
				eq(productMapping.tripletexEnv, tripletexEnv),
			),
		)
		.limit(1);

	if (existingMapping) {
		// Check if hash changed
		if (existingMapping.hash === hash) {
			logger.debug(`Skipping product ${productCode} (no changes)`, "sync-products", {
				productCode,
				tripletexEnv,
			});
			return;
		}

		// Hash changed, update product in Tripletex
		logger.info(`Updating product ${productCode} in Tripletex`, "sync-products", {
			productCode,
			tripletexProductId: existingMapping.tripletexProductId,
			tripletexEnv,
		});

		const tripletexProduct = mapRubicProductToTripletex(rubicProduct);
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
			.where(
				and(
					eq(productMapping.rubicProductCode, productCode),
					eq(productMapping.tripletexEnv, tripletexEnv),
				),
			);
	} else {
		// No mapping exists, search Tripletex by product number
		logger.info(`Searching for product ${productCode} in Tripletex`, "sync-products", {
			productCode,
			tripletexEnv,
		});

		let tripletexProductId: number;

		const existingTripletexProduct = await tripletexClient.getProductByNumber(productCode);
		if (existingTripletexProduct?.id) {
			tripletexProductId = existingTripletexProduct.id;
			logger.info(`Found existing product ${productCode} in Tripletex`, "sync-products", {
				productCode,
				tripletexProductId,
				tripletexEnv,
			});

			const tripletexProduct = mapRubicProductToTripletex(rubicProduct);
			const updatePayload: typeof tripletexProduct & { id: number; version?: number } = {
				...tripletexProduct,
				id: tripletexProductId,
				version: existingTripletexProduct.version,
			};

			await tripletexClient.updateProduct(tripletexProductId, updatePayload);
		} else {
			logger.info(`Creating product ${productCode} in Tripletex`, "sync-products", {
				productCode,
				tripletexEnv,
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
				tripletexEnv,
			});
		}

		// Create mapping
		await dbInstance.insert(productMapping).values({
			rubicProductCode: productCode,
			tripletexEnv,
			tripletexProductId,
			hash,
			lastSyncedAt: new Date(),
		});
	}
}
