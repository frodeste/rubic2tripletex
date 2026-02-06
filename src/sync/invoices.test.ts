import { describe, expect, test } from "bun:test";
import { mapRubicInvoiceToTripletexOrder } from "@/mappers/invoice.mapper";
import type { RubicInvoice, RubicInvoiceLine } from "@/types/rubic";

describe("Invoice Mapper", () => {
	test("mapRubicInvoiceToTripletexOrder maps invoice lines correctly", () => {
		const invoiceLines: RubicInvoiceLine[] = [
			{
				invoiceLineID: 1,
				productID: 100,
				productCode: "PROD-001",
				productName: "Test Product",
				productGroupName: "Group A",
				accountNumber: "1234",
				departmentID: 1,
				departmentNumber: "DEPT-1",
				departmentName: "Department 1",
				price: 99.99,
				specification: "Test specification",
				quantity: 2,
				discountPercentage: 10,
				discount: 10.0,
				taxPercentage: 25,
				netTotal: 179.98,
				tax: 45.0,
				grossTotal: 224.98,
			},
			{
				invoiceLineID: 2,
				productID: 200,
				productCode: "PROD-002",
				productName: "Another Product",
				productGroupName: "Group B",
				accountNumber: "5678",
				departmentID: 2,
				departmentNumber: "DEPT-2",
				departmentName: "Department 2",
				price: 50.0,
				specification: null,
				quantity: 1,
				discountPercentage: 0,
				discount: 0,
				taxPercentage: 25,
				netTotal: 50.0,
				tax: 12.5,
				grossTotal: 62.5,
			},
		];

		const invoice: RubicInvoice = {
			customer: {
				customerNo: "CUST-001",
				customerType: 1,
				customerTypeName: "Individual",
				customerName: "Test Customer",
				email: "test@example.com",
				countryCode: "+47",
				mobile: "12345678",
				address: "Test Street 1",
				address2: null,
				zipCode: "0001",
				city: "Oslo",
				countryName: "Norway",
				ledgerCustomerNo: "LEDGER-001",
			},
			invoiceID: 1,
			invoiceNumber: 1001,
			orderID: 500,
			invoiceDate: "2025-01-15T00:00:00Z",
			sentDate: "2025-01-15T00:00:00Z",
			dueDate: "2025-02-15T00:00:00Z",
			ledgerYear: 2025,
			netTotal: 229.98,
			taxTotal: 57.5,
			grossTotal: 287.48,
			balance: 287.48,
			paidAmount: 0,
			creditedAmount: 0,
			correctedAmount: 0,
			creditNoteAmount: 0,
			unpaidAmount: 287.48,
			totalAmount: 287.48,
			paymentStatus: 0,
			paymentStatusText: "Unpaid",
			created: "2025-01-15T00:00:00Z",
			reminderNumber: null,
			groupNames: null,
			description: null,
			externalCustomerIdentity: null,
			memberNo: 12345,
			invoiceLines,
		};

		const productMappings = new Map<string, number>([
			["PROD-001", 1001],
			["PROD-002", 1002],
		]);

		const order = mapRubicInvoiceToTripletexOrder(invoice, 500, productMappings);

		expect(order.customer.id).toBe(500);
		expect(order.deliveryDate).toBe("2025-01-15T00:00:00Z");
		expect(order.orderDate).toBe("2025-01-15T00:00:00Z");
		expect(order.orderLines).toBeDefined();
		expect(order.orderLines?.length).toBe(2);

		// Check first order line
		const line1 = order.orderLines?.[0];
		expect(line1?.product?.id).toBe(1001);
		expect(line1?.count).toBe(2);
		expect(line1?.unitPriceExcludingVatCurrency).toBe(99.99);
		expect(line1?.description).toBe("Test Product - Test specification");
		expect(line1?.discount).toBe(10.0);

		// Check second order line
		const line2 = order.orderLines?.[1];
		expect(line2?.product?.id).toBe(1002);
		expect(line2?.count).toBe(1);
		expect(line2?.unitPriceExcludingVatCurrency).toBe(50.0);
		expect(line2?.description).toBe("Another Product");
		expect(line2?.discount).toBeUndefined();
	});

	test("mapRubicInvoiceToTripletexOrder handles missing product mappings gracefully", () => {
		const invoiceLines: RubicInvoiceLine[] = [
			{
				invoiceLineID: 1,
				productID: 100,
				productCode: "PROD-001",
				productName: "Test Product",
				productGroupName: "Group A",
				accountNumber: "1234",
				departmentID: 1,
				departmentNumber: "DEPT-1",
				departmentName: "Department 1",
				price: 99.99,
				specification: null,
				quantity: 1,
				discountPercentage: 0,
				discount: 0,
				taxPercentage: 25,
				netTotal: 99.99,
				tax: 25.0,
				grossTotal: 124.99,
			},
			{
				invoiceLineID: 2,
				productID: 200,
				productCode: "PROD-UNMAPPED",
				productName: "Unmapped Product",
				productGroupName: "Group B",
				accountNumber: "5678",
				departmentID: 2,
				departmentNumber: "DEPT-2",
				departmentName: "Department 2",
				price: 50.0,
				specification: null,
				quantity: 1,
				discountPercentage: 0,
				discount: 0,
				taxPercentage: 25,
				netTotal: 50.0,
				tax: 12.5,
				grossTotal: 62.5,
			},
		];

		const invoice: RubicInvoice = {
			customer: {
				customerNo: "CUST-001",
				customerType: 1,
				customerTypeName: "Individual",
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
			invoiceID: 1,
			invoiceNumber: 1001,
			orderID: 500,
			invoiceDate: "2025-01-15T00:00:00Z",
			sentDate: "2025-01-15T00:00:00Z",
			dueDate: "2025-02-15T00:00:00Z",
			ledgerYear: 2025,
			netTotal: 149.99,
			taxTotal: 37.5,
			grossTotal: 187.49,
			balance: 187.49,
			paidAmount: 0,
			creditedAmount: 0,
			correctedAmount: 0,
			creditNoteAmount: 0,
			unpaidAmount: 187.49,
			totalAmount: 187.49,
			paymentStatus: 0,
			paymentStatusText: "Unpaid",
			created: "2025-01-15T00:00:00Z",
			reminderNumber: null,
			groupNames: null,
			description: null,
			externalCustomerIdentity: null,
			memberNo: 12345,
			invoiceLines,
		};

		const productMappings = new Map<string, number>([
			["PROD-001", 1001],
			// PROD-UNMAPPED is not in the map
		]);

		const order = mapRubicInvoiceToTripletexOrder(invoice, 500, productMappings);

		expect(order.customer.id).toBe(500);
		expect(order.orderLines).toBeDefined();
		// Only one line should be included (the mapped one)
		expect(order.orderLines?.length).toBe(1);
		expect(order.orderLines?.[0]?.product?.id).toBe(1001);
	});

	test("mapRubicInvoiceToTripletexOrder handles lines without product code", () => {
		const invoiceLines: RubicInvoiceLine[] = [
			{
				invoiceLineID: 1,
				productID: 100,
				productCode: null,
				productName: "Product without code",
				productGroupName: "Group A",
				accountNumber: "1234",
				departmentID: 1,
				departmentNumber: "DEPT-1",
				departmentName: "Department 1",
				price: 99.99,
				specification: null,
				quantity: 1,
				discountPercentage: 0,
				discount: 0,
				taxPercentage: 25,
				netTotal: 99.99,
				tax: 25.0,
				grossTotal: 124.99,
			},
		];

		const invoice: RubicInvoice = {
			customer: {
				customerNo: "CUST-001",
				customerType: 1,
				customerTypeName: "Individual",
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
			invoiceID: 1,
			invoiceNumber: 1001,
			orderID: 500,
			invoiceDate: "2025-01-15T00:00:00Z",
			sentDate: "2025-01-15T00:00:00Z",
			dueDate: "2025-02-15T00:00:00Z",
			ledgerYear: 2025,
			netTotal: 99.99,
			taxTotal: 25.0,
			grossTotal: 124.99,
			balance: 124.99,
			paidAmount: 0,
			creditedAmount: 0,
			correctedAmount: 0,
			creditNoteAmount: 0,
			unpaidAmount: 124.99,
			totalAmount: 124.99,
			paymentStatus: 0,
			paymentStatusText: "Unpaid",
			created: "2025-01-15T00:00:00Z",
			reminderNumber: null,
			groupNames: null,
			description: null,
			externalCustomerIdentity: null,
			memberNo: 12345,
			invoiceLines,
		};

		const productMappings = new Map<string, number>();

		const order = mapRubicInvoiceToTripletexOrder(invoice, 500, productMappings);

		expect(order.customer.id).toBe(500);
		// No order lines should be included (line has no product code)
		expect(order.orderLines).toBeUndefined();
	});

	test("mapRubicInvoiceToTripletexOrder sets customer reference correctly", () => {
		const invoice: RubicInvoice = {
			customer: {
				customerNo: "CUST-001",
				customerType: 1,
				customerTypeName: "Individual",
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
			invoiceID: 1,
			invoiceNumber: 1001,
			orderID: 500,
			invoiceDate: "2025-01-15T00:00:00Z",
			sentDate: "2025-01-15T00:00:00Z",
			dueDate: "2025-02-15T00:00:00Z",
			ledgerYear: 2025,
			netTotal: 0,
			taxTotal: 0,
			grossTotal: 0,
			balance: 0,
			paidAmount: 0,
			creditedAmount: 0,
			correctedAmount: 0,
			creditNoteAmount: 0,
			unpaidAmount: 0,
			totalAmount: 0,
			paymentStatus: 0,
			paymentStatusText: "Unpaid",
			created: "2025-01-15T00:00:00Z",
			reminderNumber: null,
			groupNames: null,
			description: null,
			externalCustomerIdentity: null,
			memberNo: 12345,
			invoiceLines: null,
		};

		const productMappings = new Map<string, number>();
		const tripletexCustomerId = 999;

		const order = mapRubicInvoiceToTripletexOrder(invoice, tripletexCustomerId, productMappings);

		expect(order.customer.id).toBe(999);
		expect(order.deliveryDate).toBe("2025-01-15T00:00:00Z");
		expect(order.orderDate).toBe("2025-01-15T00:00:00Z");
	});
});
