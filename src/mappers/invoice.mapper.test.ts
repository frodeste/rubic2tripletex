import { describe, expect, test } from "bun:test";
import { mapRubicInvoiceToTripletexOrder } from "@/mappers/invoice.mapper";
import type { RubicInvoice, RubicInvoiceLine } from "@/types/rubic";

function makeInvoice(overrides?: Partial<RubicInvoice>): RubicInvoice {
	return {
		customer: {
			customerNo: "100",
			customerType: 1,
			customerTypeName: "Individual",
			customerName: "Test Customer",
			email: "test@example.com",
			countryCode: "+47",
			mobile: "12345678",
			address: "Street 1",
			address2: null,
			zipCode: "0001",
			city: "Oslo",
			countryName: "Norway",
			ledgerCustomerNo: null,
		},
		invoiceID: 1001,
		invoiceNumber: 5001,
		orderID: 2001,
		invoiceDate: "2025-06-01",
		sentDate: "2025-06-01",
		dueDate: "2025-07-01",
		ledgerYear: 2025,
		netTotal: 499.0,
		taxTotal: 124.75,
		grossTotal: 623.75,
		balance: 0,
		paidAmount: 623.75,
		creditedAmount: 0,
		correctedAmount: 0,
		creditNoteAmount: 0,
		unpaidAmount: 0,
		totalAmount: 623.75,
		paymentStatus: 1,
		paymentStatusText: "Paid",
		created: "2025-06-01T10:00:00Z",
		reminderNumber: null,
		groupNames: null,
		description: null,
		externalCustomerIdentity: null,
		memberNo: 100,
		invoiceLines: null,
		...overrides,
	};
}

function makeLine(overrides?: Partial<RubicInvoiceLine>): RubicInvoiceLine {
	return {
		invoiceLineID: 1,
		productID: 10,
		productCode: "PROD-001",
		productName: "Annual Membership",
		productGroupName: "Memberships",
		accountNumber: "3000",
		departmentID: 5,
		departmentNumber: "100",
		departmentName: "Sales",
		price: 499.0,
		specification: null,
		quantity: 1,
		discountPercentage: 0,
		discount: 0,
		taxPercentage: 25,
		netTotal: 499.0,
		tax: 124.75,
		grossTotal: 623.75,
		...overrides,
	};
}

describe("Invoice Mapper", () => {
	const productMappings = new Map<string, number>([
		["PROD-001", 501],
		["PROD-002", 502],
	]);
	const tripletexCustomerId = 42;

	test("maps basic invoice to order with correct customer and dates", () => {
		const invoice = makeInvoice({ invoiceLines: [makeLine()] });
		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.customer.id).toBe(42);
		expect(order.deliveryDate).toBe("2025-06-01");
		expect(order.orderDate).toBe("2025-06-01");
	});

	test("maps invoice lines to order lines with product lookup", () => {
		const invoice = makeInvoice({
			invoiceLines: [
				makeLine({ productCode: "PROD-001", price: 499.0, quantity: 1 }),
				makeLine({
					invoiceLineID: 2,
					productCode: "PROD-002",
					price: 199.0,
					quantity: 2,
				}),
			],
		});

		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.orderLines).toHaveLength(2);
		expect(order.orderLines?.[0].product?.id).toBe(501);
		expect(order.orderLines?.[0].unitPriceExcludingVatCurrency).toBe(499.0);
		expect(order.orderLines?.[0].count).toBe(1);
		expect(order.orderLines?.[1].product?.id).toBe(502);
		expect(order.orderLines?.[1].count).toBe(2);
	});

	test("skips lines without product code", () => {
		const invoice = makeInvoice({
			invoiceLines: [makeLine({ productCode: null })],
		});

		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.orderLines).toBeUndefined();
	});

	test("skips lines with unmapped product codes", () => {
		const invoice = makeInvoice({
			invoiceLines: [makeLine({ productCode: "UNKNOWN" })],
		});

		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.orderLines).toBeUndefined();
	});

	test("includes discount when present", () => {
		const invoice = makeInvoice({
			invoiceLines: [makeLine({ discount: 50 })],
		});

		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.orderLines?.[0].discount).toBe(50);
	});

	test("does not include discount when zero", () => {
		const invoice = makeInvoice({
			invoiceLines: [makeLine({ discount: 0 })],
		});

		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.orderLines?.[0].discount).toBeUndefined();
	});

	test("builds description from productName and specification", () => {
		const invoice = makeInvoice({
			invoiceLines: [makeLine({ productName: "Membership", specification: "2025 Q1" })],
		});

		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.orderLines?.[0].description).toBe("Membership - 2025 Q1");
	});

	test("builds description from productName only when no specification", () => {
		const invoice = makeInvoice({
			invoiceLines: [makeLine({ productName: "Membership", specification: null })],
		});

		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.orderLines?.[0].description).toBe("Membership");
	});

	test("handles invoice with null invoiceLines", () => {
		const invoice = makeInvoice({ invoiceLines: null });

		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.orderLines).toBeUndefined();
		expect(order.customer.id).toBe(42);
	});

	test("handles invoice with empty invoiceLines", () => {
		const invoice = makeInvoice({ invoiceLines: [] });

		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.orderLines).toBeUndefined();
	});
});
