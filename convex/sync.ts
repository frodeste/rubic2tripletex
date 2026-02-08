"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { RubicClient } from "./lib/rubicClient";
import { TripletexClient, type TripletexCustomer } from "./lib/tripletexClient";
import {
	computeCustomerHash,
	computeProductHash,
	mapRubicCustomerToTripletex,
	mapRubicInvoiceToTripletexOrder,
	mapRubicProductToTripletex,
} from "./lib/mappers";
import { tripletexEnv as tripletexEnvValidator } from "./validators";

// --- Helpers ---

interface CredentialPair {
	rubic: { baseUrl: string; apiKey: string; organizationId: number };
	tripletex: { baseUrl: string; consumerToken: string; employeeToken: string };
}

async function getCredentials(
	ctx: { runQuery: (query: any, args: any) => Promise<any> },
	organizationId: any,
	tripletexEnv: "sandbox" | "production",
): Promise<CredentialPair> {
	const rubicCred = await ctx.runQuery(api.apiCredentials.getRubicCredentials, {
		organizationId,
	});
	if (!rubicCred || !rubicCred.isEnabled) {
		throw new Error("Rubic API credentials not configured or disabled for this organization");
	}

	const tripletexCred = await ctx.runQuery(api.apiCredentials.getForSync, {
		organizationId,
		provider: "tripletex",
		environment: tripletexEnv,
	});
	if (!tripletexCred || !tripletexCred.isEnabled) {
		throw new Error(
			`Tripletex ${tripletexEnv} credentials not configured or disabled for this organization`,
		);
	}

	const rubicParsed = JSON.parse(rubicCred.credentials);
	const tripletexParsed = JSON.parse(tripletexCred.credentials);

	return {
		rubic: {
			baseUrl: rubicCred.baseUrl,
			apiKey: rubicParsed.apiKey,
			organizationId: rubicParsed.organizationId,
		},
		tripletex: {
			baseUrl: tripletexCred.baseUrl,
			consumerToken: tripletexParsed.consumerToken,
			employeeToken: tripletexParsed.employeeToken,
		},
	};
}

// --- Customer Sync ---

export const runCustomers = action({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnvValidator,
	},
	handler: async (ctx, args) => {
		const creds = await getCredentials(ctx, args.organizationId, args.tripletexEnv);
		const rubicClient = new RubicClient(creds.rubic);
		const tripletexClient = new TripletexClient(creds.tripletex);

		// Start sync state
		const syncStateId = await ctx.runMutation(api.syncState.start, {
			organizationId: args.organizationId,
			syncType: "customers",
			tripletexEnv: args.tripletexEnv,
		});

		let processed = 0;
		let failed = 0;

		try {
			const rubicCustomers = await rubicClient.getCustomers();

			for (const rubicCustomer of rubicCustomers) {
				if (!rubicCustomer.customerNo) continue;

				try {
					const customerNo = rubicCustomer.customerNo;
					const newHash = await computeCustomerHash(rubicCustomer);

					// Check existing mapping
					const existingMapping = await ctx.runQuery(api.customerMapping.getByRubicNo, {
						organizationId: args.organizationId,
						rubicCustomerNo: customerNo,
						tripletexEnv: args.tripletexEnv,
					});

					let tripletexCustomerId: number;

					if (existingMapping) {
						if (existingMapping.hash === newHash) {
							processed++;
							continue;
						}

						// Hash changed, update
						tripletexCustomerId = existingMapping.tripletexCustomerId;
						const tripletexCustomer = mapRubicCustomerToTripletex(rubicCustomer);

						const customerNumber = Number.parseInt(customerNo, 10);
						let existingTtxCustomer: TripletexCustomer | null = null;
						if (!Number.isNaN(customerNumber)) {
							existingTtxCustomer = await tripletexClient.getCustomerByNumber(customerNumber);
						}

						if (existingTtxCustomer?.id === tripletexCustomerId && existingTtxCustomer.version) {
							tripletexCustomer.id = existingTtxCustomer.id;
							tripletexCustomer.version = existingTtxCustomer.version;
						} else {
							tripletexCustomer.id = tripletexCustomerId;
						}

						await tripletexClient.updateCustomer(tripletexCustomerId, tripletexCustomer);
					} else {
						// No mapping -- search or create
						const customerNumber = Number.parseInt(customerNo, 10);
						let existingTtxCustomer: TripletexCustomer | null = null;

						if (!Number.isNaN(customerNumber)) {
							existingTtxCustomer = await tripletexClient.getCustomerByNumber(customerNumber);
						}

						if (existingTtxCustomer?.id) {
							tripletexCustomerId = existingTtxCustomer.id;
						} else {
							const tripletexCustomer = mapRubicCustomerToTripletex(rubicCustomer);
							const createResponse = await tripletexClient.createCustomer(tripletexCustomer);
							if (!createResponse.value.id) {
								throw new Error("Failed to create customer: no ID returned");
							}
							tripletexCustomerId = createResponse.value.id;
						}
					}

					// Upsert mapping
					await ctx.runMutation(api.customerMapping.upsert, {
						organizationId: args.organizationId,
						rubicCustomerNo: customerNo,
						tripletexEnv: args.tripletexEnv,
						tripletexCustomerId,
						hash: newHash,
					});

					processed++;
				} catch (error) {
					failed++;
					console.error(
						`Failed to sync customer ${rubicCustomer.customerNo}:`,
						error instanceof Error ? error.message : String(error),
					);
				}
			}

			await ctx.runMutation(api.syncState.complete, {
				syncStateId,
				recordsProcessed: processed,
				recordsFailed: failed,
			});

			return { processed, failed };
		} catch (error) {
			await ctx.runMutation(api.syncState.fail, {
				syncStateId,
				errorMessage: error instanceof Error ? error.message : String(error),
				recordsProcessed: processed,
				recordsFailed: failed,
			});
			throw error;
		}
	},
});

// --- Product Sync ---

export const runProducts = action({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnvValidator,
	},
	handler: async (ctx, args) => {
		const creds = await getCredentials(ctx, args.organizationId, args.tripletexEnv);
		const rubicClient = new RubicClient(creds.rubic);
		const tripletexClient = new TripletexClient(creds.tripletex);

		const syncStateId = await ctx.runMutation(api.syncState.start, {
			organizationId: args.organizationId,
			syncType: "products",
			tripletexEnv: args.tripletexEnv,
		});

		let processed = 0;
		let failed = 0;

		try {
			const rubicProducts = await rubicClient.getProducts();
			const validProducts = rubicProducts.filter(
				(p) => p.productCode !== null && p.productCode !== undefined && p.productCode.trim() !== "",
			);

			for (const rubicProduct of validProducts) {
				try {
					const productCode = rubicProduct.productCode!;
					const hash = await computeProductHash(rubicProduct);

					const existingMapping = await ctx.runQuery(api.productMapping.getByRubicCode, {
						organizationId: args.organizationId,
						rubicProductCode: productCode,
						tripletexEnv: args.tripletexEnv,
					});

					if (existingMapping) {
						if (existingMapping.hash === hash) {
							processed++;
							continue;
						}

						// Update product in Tripletex
						const tripletexProduct = mapRubicProductToTripletex(rubicProduct);
						await tripletexClient.updateProduct(existingMapping.tripletexProductId, {
							...tripletexProduct,
							id: existingMapping.tripletexProductId,
						});

						await ctx.runMutation(api.productMapping.upsert, {
							organizationId: args.organizationId,
							rubicProductCode: productCode,
							tripletexEnv: args.tripletexEnv,
							tripletexProductId: existingMapping.tripletexProductId,
							hash,
						});
					} else {
						// Search or create in Tripletex
						let tripletexProductId: number;

						const existingTtxProduct = await tripletexClient.getProductByNumber(productCode);
						if (existingTtxProduct?.id) {
							tripletexProductId = existingTtxProduct.id;
							// Update existing
							await tripletexClient.updateProduct(tripletexProductId, {
								...mapRubicProductToTripletex(rubicProduct),
								id: tripletexProductId,
								version: existingTtxProduct.version,
							});
						} else {
							const createResponse = await tripletexClient.createProduct(
								mapRubicProductToTripletex(rubicProduct),
							);
							if (!createResponse.value.id) {
								throw new Error("Failed to create product: no ID returned");
							}
							tripletexProductId = createResponse.value.id;
						}

						await ctx.runMutation(api.productMapping.upsert, {
							organizationId: args.organizationId,
							rubicProductCode: productCode,
							tripletexEnv: args.tripletexEnv,
							tripletexProductId,
							hash,
						});
					}

					processed++;
				} catch (error) {
					failed++;
					console.error(
						`Failed to sync product ${rubicProduct.productCode}:`,
						error instanceof Error ? error.message : String(error),
					);
				}
			}

			await ctx.runMutation(api.syncState.complete, {
				syncStateId,
				recordsProcessed: processed,
				recordsFailed: failed,
			});

			return { processed, failed };
		} catch (error) {
			await ctx.runMutation(api.syncState.fail, {
				syncStateId,
				errorMessage: error instanceof Error ? error.message : String(error),
				recordsProcessed: processed,
				recordsFailed: failed,
			});
			throw error;
		}
	},
});

// --- Invoice Sync ---

export const runInvoices = action({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnvValidator,
	},
	handler: async (ctx, args) => {
		const creds = await getCredentials(ctx, args.organizationId, args.tripletexEnv);
		const rubicClient = new RubicClient(creds.rubic);
		const tripletexClient = new TripletexClient(creds.tripletex);

		const syncStateId = await ctx.runMutation(api.syncState.start, {
			organizationId: args.organizationId,
			syncType: "invoices",
			tripletexEnv: args.tripletexEnv,
		});

		let processed = 0;
		let failed = 0;

		try {
			// Get last sync timestamp
			const lastSync = await ctx.runQuery(api.syncState.getLatest, {
				organizationId: args.organizationId,
				syncType: "invoices",
				tripletexEnv: args.tripletexEnv,
			});

			const startPeriod = lastSync?.lastSyncAt ? new Date(lastSync.lastSyncAt) : undefined;
			const endPeriod = new Date();

			// Fetch invoices from Rubic
			const rubicInvoices = await rubicClient.getInvoices(startPeriod, endPeriod);

			// Load customer mappings
			const customerMappings = await ctx.runQuery(api.customerMapping.list, {
				organizationId: args.organizationId,
				tripletexEnv: args.tripletexEnv,
				limit: 10000,
			});
			const customerMap = new Map<string, number>();
			for (const m of customerMappings) {
				customerMap.set(m.rubicCustomerNo, m.tripletexCustomerId);
			}

			// Load product mappings
			const productMappings = await ctx.runQuery(api.productMapping.list, {
				organizationId: args.organizationId,
				tripletexEnv: args.tripletexEnv,
				limit: 10000,
			});
			const productMap = new Map<string, number>();
			for (const m of productMappings) {
				productMap.set(m.rubicProductCode, m.tripletexProductId);
			}

			// Load existing invoice mappings to check what's already synced
			const existingInvoiceMappings = await ctx.runQuery(api.invoiceMapping.list, {
				organizationId: args.organizationId,
				tripletexEnv: args.tripletexEnv,
				limit: 10000,
			});
			const syncedInvoiceIds = new Set(existingInvoiceMappings.map((m: any) => m.rubicInvoiceId));

			for (const invoice of rubicInvoices) {
				try {
					if (syncedInvoiceIds.has(invoice.invoiceID)) {
						processed++;
						continue;
					}

					const customerNo = invoice.customer.customerNo;
					if (!customerNo) {
						failed++;
						continue;
					}

					const tripletexCustomerId = customerMap.get(customerNo);
					if (!tripletexCustomerId) {
						failed++;
						continue;
					}

					if (!invoice.invoiceLines || invoice.invoiceLines.length === 0) {
						failed++;
						continue;
					}

					const validLines = invoice.invoiceLines.filter(
						(line) => line.productCode && productMap.has(line.productCode),
					);
					if (validLines.length === 0) {
						failed++;
						continue;
					}

					const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMap);

					const orderResponse = await tripletexClient.createOrder(order);
					if (!orderResponse.value.id) {
						throw new Error("Failed to create order: no ID returned");
					}

					const invoiceResponse = await tripletexClient.createInvoiceFromOrder(
						orderResponse.value.id,
						invoice.invoiceDate,
					);
					if (!invoiceResponse.value.id) {
						throw new Error("Failed to create invoice: no ID returned");
					}

					await ctx.runMutation(api.invoiceMapping.upsert, {
						organizationId: args.organizationId,
						rubicInvoiceId: invoice.invoiceID,
						tripletexEnv: args.tripletexEnv,
						rubicInvoiceNumber: invoice.invoiceNumber,
						tripletexInvoiceId: invoiceResponse.value.id,
					});

					processed++;
				} catch (error) {
					failed++;
					console.error(
						`Failed to sync invoice ${invoice.invoiceID}:`,
						error instanceof Error ? error.message : String(error),
					);
				}
			}

			await ctx.runMutation(api.syncState.complete, {
				syncStateId,
				recordsProcessed: processed,
				recordsFailed: failed,
			});

			return { processed, failed };
		} catch (error) {
			await ctx.runMutation(api.syncState.fail, {
				syncStateId,
				errorMessage: error instanceof Error ? error.message : String(error),
				recordsProcessed: processed,
				recordsFailed: failed,
			});
			throw error;
		}
	},
});

// --- Payment Sync ---

export const runPayments = action({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnvValidator,
	},
	handler: async (ctx, args) => {
		const creds = await getCredentials(ctx, args.organizationId, args.tripletexEnv);
		const rubicClient = new RubicClient(creds.rubic);
		const tripletexClient = new TripletexClient(creds.tripletex);

		const syncStateId = await ctx.runMutation(api.syncState.start, {
			organizationId: args.organizationId,
			syncType: "payments",
			tripletexEnv: args.tripletexEnv,
		});

		let processed = 0;
		let failed = 0;

		try {
			// Get last sync timestamp
			const lastSync = await ctx.runQuery(api.syncState.getLatest, {
				organizationId: args.organizationId,
				syncType: "payments",
				tripletexEnv: args.tripletexEnv,
			});

			const startPeriod = lastSync?.lastSyncAt ? new Date(lastSync.lastSyncAt) : undefined;
			const endPeriod = new Date();

			const transactions = await rubicClient.getInvoiceTransactions(startPeriod, endPeriod);

			// Load invoice mappings with unsynced payments
			const unsyncedInvoices = await ctx.runQuery(api.invoiceMapping.getUnsyncedPayments, {
				organizationId: args.organizationId,
				tripletexEnv: args.tripletexEnv,
			});
			const invoiceMap = new Map<number, any>();
			for (const m of unsyncedInvoices) {
				invoiceMap.set(m.rubicInvoiceId, m);
			}

			for (const transaction of transactions) {
				try {
					const mapping = invoiceMap.get(transaction.invoiceID);
					if (!mapping) continue;
					if (mapping.paymentSynced) continue;

					await tripletexClient.registerPayment(mapping.tripletexInvoiceId, {
						amount: transaction.paidAmount,
						paymentDate: transaction.paymentDate,
					});

					await ctx.runMutation(api.invoiceMapping.markPaymentSynced, {
						invoiceMappingId: mapping._id,
					});

					processed++;
				} catch (error) {
					failed++;
					console.error(
						`Failed to sync payment for transaction ${transaction.invoiceTransactionID}:`,
						error instanceof Error ? error.message : String(error),
					);
				}
			}

			await ctx.runMutation(api.syncState.complete, {
				syncStateId,
				recordsProcessed: processed,
				recordsFailed: failed,
			});

			return { processed, failed };
		} catch (error) {
			await ctx.runMutation(api.syncState.fail, {
				syncStateId,
				errorMessage: error instanceof Error ? error.message : String(error),
				recordsProcessed: processed,
				recordsFailed: failed,
			});
			throw error;
		}
	},
});

// --- Test Connection ---

export const testConnection = action({
	args: {
		organizationId: v.id("organizations"),
		provider: v.union(v.literal("rubic"), v.literal("tripletex")),
		environment: tripletexEnvValidator,
	},
	handler: async (ctx, args) => {
		if (args.provider === "rubic") {
			const rubicCred = await ctx.runQuery(api.apiCredentials.getRubicCredentials, {
				organizationId: args.organizationId,
			});
			if (!rubicCred) {
				return { success: false, error: "Rubic credentials not configured" };
			}

			try {
				const parsed = JSON.parse(rubicCred.credentials);
				const client = new RubicClient({
					baseUrl: rubicCred.baseUrl,
					apiKey: parsed.apiKey,
					organizationId: parsed.organizationId,
				});
				const customers = await client.getCustomers();
				await ctx.runMutation(api.apiCredentials.markVerified, {
					credentialId: rubicCred._id,
				});
				return { success: true, message: `Connected. Found ${customers.length} customers.` };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}

		// Tripletex
		const tripletexCred = await ctx.runQuery(api.apiCredentials.getForSync, {
			organizationId: args.organizationId,
			provider: "tripletex",
			environment: args.environment,
		});
		if (!tripletexCred) {
			return {
				success: false,
				error: `Tripletex ${args.environment} credentials not configured`,
			};
		}

		try {
			const parsed = JSON.parse(tripletexCred.credentials);
			const client = new TripletexClient({
				baseUrl: tripletexCred.baseUrl,
				consumerToken: parsed.consumerToken,
				employeeToken: parsed.employeeToken,
			});
			const departments = await client.getDepartments();
			await ctx.runMutation(api.apiCredentials.markVerified, {
				credentialId: tripletexCred._id,
			});
			return {
				success: true,
				message: `Connected. Found ${departments.values.length} departments.`,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},
});

// --- Department Fetching ---

export const fetchDepartmentsFromRubic = action({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		const rubicCred = await ctx.runQuery(api.apiCredentials.getRubicCredentials, {
			organizationId: args.organizationId,
		});
		if (!rubicCred) throw new Error("Rubic credentials not configured");

		const parsed = JSON.parse(rubicCred.credentials);
		const client = new RubicClient({
			baseUrl: rubicCred.baseUrl,
			apiKey: parsed.apiKey,
			organizationId: parsed.organizationId,
		});

		return await client.getDepartments();
	},
});

export const fetchDepartmentsFromTripletex = action({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnvValidator,
	},
	handler: async (ctx, args) => {
		const tripletexCred = await ctx.runQuery(api.apiCredentials.getForSync, {
			organizationId: args.organizationId,
			provider: "tripletex",
			environment: args.tripletexEnv,
		});
		if (!tripletexCred) throw new Error("Tripletex credentials not configured");

		const parsed = JSON.parse(tripletexCred.credentials);
		const client = new TripletexClient({
			baseUrl: tripletexCred.baseUrl,
			consumerToken: parsed.consumerToken,
			employeeToken: parsed.employeeToken,
		});

		const result = await client.getDepartments();
		return result.values;
	},
});
