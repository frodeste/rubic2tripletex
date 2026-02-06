import { describe, expect, mock, test } from "bun:test";
import { RubicClient } from "@/clients/rubic";
import { TripletexClient } from "@/clients/tripletex";
import type { RubicInvoiceTransaction } from "@/types/rubic";
import { syncPayments } from "./payments";

describe("syncPayments", () => {
	let rubicClient: RubicClient;
	let tripletexClient: TripletexClient;

	beforeEach(() => {
		rubicClient = new RubicClient({
			baseUrl: "https://rubic-api.test",
			apiKey: "test-api-key",
			organizationId: 123,
		});

		tripletexClient = new TripletexClient({
			baseUrl: "https://tripletex.no/v2",
			consumerToken: "test-consumer-token",
			employeeToken: "test-employee-token",
		});
	});

	test("skips transactions without invoice mappings", async () => {
		const transaction: RubicInvoiceTransaction = {
			invoiceTransactionID: 1,
			invoiceID: 100,
			invoiceNumber: 1000,
			paymentDate: "2025-01-15T00:00:00Z",
			expectedPayoutDate: null,
			transactionTypeID: 1,
			transactionTypeName: "Payment",
			paidAmount: 1000,
			paymentFee: 0,
			vatPaymentFee: 0,
			payoutAmount: 1000,
			customer: {
				customerNo: "C001",
				customerType: 1,
				customerTypeName: "Person",
				customerName: "Test Customer",
				email: null,
				countryCode: null,
				mobile: null,
				address: null,
				address2: null,
				zipCode: null,
				city: null,
				countryName: null,
				ledgerCustomerNo: null,
			},
		};

		// Create a chainable mock database
		// All methods return the same chainable object except limit/returning which return promises
		const chainable: any = {};
		chainable.select = mock(() => chainable);
		chainable.from = mock(() => chainable);
		chainable.where = mock(() => chainable);
		chainable.orderBy = mock(() => chainable);
		chainable.limit = mock(() => Promise.resolve([]));
		chainable.insert = mock(() => chainable);
		chainable.values = mock(() => chainable);
		chainable.returning = mock(() =>
			Promise.resolve([
				{
					id: 1,
					syncType: "payments",
					status: "running",
					recordsProcessed: 0,
					recordsFailed: 0,
				},
			]),
		);
		chainable.update = mock(() => chainable);
		chainable.set = mock(() => chainable);

		// Mock Rubic client to return transaction
		const originalGetInvoiceTransactions = rubicClient.getInvoiceTransactions;
		rubicClient.getInvoiceTransactions = mock(async () => [transaction]);

		// Mock limit to return empty array for invoice mapping query (second call)
		chainable.limit = mock(() => Promise.resolve([]));

		// Mock where - first calls return chainable, last call (for update) returns promise
		let whereCallCount = 0;
		chainable.where = mock(() => {
			whereCallCount++;
			// First two calls are for queries (select chain), return chainable
			if (whereCallCount <= 2) {
				return chainable;
			}
			// Last call is for update, return promise
			return Promise.resolve(undefined);
		});

		const result = await syncPayments(rubicClient, tripletexClient, chainable as any);

		expect(result.processed).toBe(0);
		expect(result.failed).toBe(0);

		// Restore original method
		rubicClient.getInvoiceTransactions = originalGetInvoiceTransactions;
	});

	test("skips already-synced payments", async () => {
		const transaction: RubicInvoiceTransaction = {
			invoiceTransactionID: 1,
			invoiceID: 100,
			invoiceNumber: 1000,
			paymentDate: "2025-01-15T00:00:00Z",
			expectedPayoutDate: null,
			transactionTypeID: 1,
			transactionTypeName: "Payment",
			paidAmount: 1000,
			paymentFee: 0,
			vatPaymentFee: 0,
			payoutAmount: 1000,
			customer: {
				customerNo: "C001",
				customerType: 1,
				customerTypeName: "Person",
				customerName: "Test Customer",
				email: null,
				countryCode: null,
				mobile: null,
				address: null,
				address2: null,
				zipCode: null,
				city: null,
				countryName: null,
				ledgerCustomerNo: null,
			},
		};

		// Create a chainable mock database
		// All methods return the same chainable object except limit/returning which return promises
		const chainable: any = {};
		chainable.select = mock(() => chainable);
		chainable.from = mock(() => chainable);
		chainable.where = mock(() => chainable);
		chainable.orderBy = mock(() => chainable);
		chainable.limit = mock(() => Promise.resolve([]));
		chainable.insert = mock(() => chainable);
		chainable.values = mock(() => chainable);
		chainable.returning = mock(() =>
			Promise.resolve([
				{
					id: 1,
					syncType: "payments",
					status: "running",
					recordsProcessed: 0,
					recordsFailed: 0,
				},
			]),
		);
		chainable.update = mock(() => chainable);
		chainable.set = mock(() => chainable);

		// Mock Rubic client to return transaction
		const originalGetInvoiceTransactions = rubicClient.getInvoiceTransactions;
		rubicClient.getInvoiceTransactions = mock(async () => [transaction]);

		// Mock limit - first call returns empty (sync state), second returns mapping with paymentSynced=true
		let limitCallCount = 0;
		chainable.limit = mock(() => {
			limitCallCount++;
			if (limitCallCount === 1) {
				// First call: sync state query
				return Promise.resolve([]);
			}
			// Second call: invoice mapping query - mapping found with paymentSynced = true
			return Promise.resolve([
				{
					rubicInvoiceId: 100,
					rubicInvoiceNumber: 1000,
					tripletexInvoiceId: 200,
					lastSyncedAt: new Date(),
					paymentSynced: true,
				},
			]);
		});

		// Mock where - first calls return chainable, last call (for update) returns promise
		let whereCallCount = 0;
		chainable.where = mock(() => {
			whereCallCount++;
			// First two calls are for queries (select chain), return chainable
			if (whereCallCount <= 2) {
				return chainable;
			}
			// Last call is for update, return promise
			return Promise.resolve(undefined);
		});

		const result = await syncPayments(rubicClient, tripletexClient, chainable as any);

		expect(result.processed).toBe(0);
		expect(result.failed).toBe(0);

		// Restore original method
		rubicClient.getInvoiceTransactions = originalGetInvoiceTransactions;
	});
});
