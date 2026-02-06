import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RubicClient } from "@/clients/rubic";
import { TripletexClient } from "@/clients/tripletex";
import type { RubicInvoiceTransaction } from "@/types/rubic";
import { syncPayments } from "./payments";

// biome-ignore lint/suspicious/noExplicitAny: mock DB requires flexible typing for chainable API
function createMockDb(): any {
	const chainable = {
		select: mock(() => chainable),
		from: mock(() => chainable),
		where: mock(() => chainable),
		orderBy: mock(() => chainable),
		limit: mock(() => Promise.resolve([])),
		insert: mock(() => chainable),
		values: mock(() => chainable),
		returning: mock(() =>
			Promise.resolve([
				{
					id: 1,
					syncType: "payments",
					status: "running",
					recordsProcessed: 0,
					recordsFailed: 0,
				},
			]),
		),
		update: mock(() => chainable),
		set: mock(() => chainable),
	};
	return chainable;
}

const sampleTransaction: RubicInvoiceTransaction = {
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
		const mockDb = createMockDb();

		// Mock Rubic client to return transaction
		const original = rubicClient.getInvoiceTransactions;
		rubicClient.getInvoiceTransactions = mock(async () => [sampleTransaction]);

		// Mock limit to return empty for invoice mapping query
		mockDb.limit = mock(() => Promise.resolve([]));

		// Mock where - first calls return chainable, last call (for update) returns promise
		let whereCallCount = 0;
		mockDb.where = mock(() => {
			whereCallCount++;
			if (whereCallCount <= 2) return mockDb;
			return Promise.resolve(undefined);
		});

		const result = await syncPayments(rubicClient, tripletexClient, mockDb);

		expect(result.processed).toBe(0);
		expect(result.failed).toBe(0);

		rubicClient.getInvoiceTransactions = original;
	});

	test("skips already-synced payments", async () => {
		const mockDb = createMockDb();

		// Mock Rubic client to return transaction
		const original = rubicClient.getInvoiceTransactions;
		rubicClient.getInvoiceTransactions = mock(async () => [sampleTransaction]);

		// Mock limit - first returns empty (sync state), second returns mapping with paymentSynced=true
		let limitCallCount = 0;
		mockDb.limit = mock(() => {
			limitCallCount++;
			if (limitCallCount === 1) return Promise.resolve([]);
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

		// Mock where
		let whereCallCount = 0;
		mockDb.where = mock(() => {
			whereCallCount++;
			if (whereCallCount <= 2) return mockDb;
			return Promise.resolve(undefined);
		});

		const result = await syncPayments(rubicClient, tripletexClient, mockDb);

		expect(result.processed).toBe(0);
		expect(result.failed).toBe(0);

		rubicClient.getInvoiceTransactions = original;
	});
});
