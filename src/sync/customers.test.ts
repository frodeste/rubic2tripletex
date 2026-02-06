import { describe, expect, test } from "bun:test";
import { computeCustomerHash, mapRubicCustomerToTripletex } from "@/mappers/customer.mapper";
import type { RubicCustomer } from "@/types/rubic";

describe("Customer Mapper", () => {
	test("mapRubicCustomerToTripletex maps all fields correctly", () => {
		const rubicCustomer: RubicCustomer = {
			customerNo: "12345",
			customerType: 1,
			customerTypeName: "Individual",
			customerName: "Test Customer",
			email: "test@example.com",
			countryCode: "+47",
			mobile: "12345678",
			address: "Test Street 1",
			address2: "Apt 2",
			zipCode: "1234",
			city: "Oslo",
			countryName: "Norway",
			ledgerCustomerNo: "LED123",
		};

		const result = mapRubicCustomerToTripletex(rubicCustomer);

		expect(result.name).toBe("Test Customer");
		expect(result.customerNumber).toBe(12345);
		expect(result.isCustomer).toBe(true);
		expect(result.email).toBe("test@example.com");
		expect(result.invoiceEmail).toBe("test@example.com");
		expect(result.phoneNumberMobile).toBe("12345678");
		expect(result.postalAddress).toBeDefined();
		expect(result.postalAddress?.addressLine1).toBe("Test Street 1");
		expect(result.postalAddress?.addressLine2).toBe("Apt 2");
		expect(result.postalAddress?.postalCode).toBe("1234");
		expect(result.postalAddress?.city).toBe("Oslo");
	});

	test("mapRubicCustomerToTripletex handles null values", () => {
		const rubicCustomer: RubicCustomer = {
			customerNo: null,
			customerType: 1,
			customerTypeName: null,
			customerName: "Minimal Customer",
			email: null,
			countryCode: null,
			mobile: null,
			address: null,
			address2: null,
			zipCode: null,
			city: null,
			countryName: null,
			ledgerCustomerNo: null,
		};

		const result = mapRubicCustomerToTripletex(rubicCustomer);

		expect(result.name).toBe("Minimal Customer");
		expect(result.isCustomer).toBe(true);
		expect(result.customerNumber).toBeUndefined();
		expect(result.email).toBeUndefined();
		expect(result.invoiceEmail).toBeUndefined();
		expect(result.phoneNumberMobile).toBeUndefined();
		expect(result.postalAddress).toBeUndefined();
	});

	test("mapRubicCustomerToTripletex handles non-numeric customerNo", () => {
		const rubicCustomer: RubicCustomer = {
			customerNo: "ABC123",
			customerType: 1,
			customerTypeName: null,
			customerName: "Customer",
			email: null,
			countryCode: null,
			mobile: null,
			address: null,
			address2: null,
			zipCode: null,
			city: null,
			countryName: null,
			ledgerCustomerNo: null,
		};

		const result = mapRubicCustomerToTripletex(rubicCustomer);

		expect(result.customerNumber).toBeUndefined();
	});

	test("mapRubicCustomerToTripletex creates postalAddress only when address fields exist", () => {
		const rubicCustomer1: RubicCustomer = {
			customerNo: "1",
			customerType: 1,
			customerTypeName: null,
			customerName: "Customer",
			email: null,
			countryCode: null,
			mobile: null,
			address: null,
			address2: null,
			zipCode: null,
			city: null,
			countryName: null,
			ledgerCustomerNo: null,
		};

		const result1 = mapRubicCustomerToTripletex(rubicCustomer1);
		expect(result1.postalAddress).toBeUndefined();

		const rubicCustomer2: RubicCustomer = {
			...rubicCustomer1,
			city: "Oslo",
		};

		const result2 = mapRubicCustomerToTripletex(rubicCustomer2);
		expect(result2.postalAddress).toBeDefined();
		expect(result2.postalAddress?.city).toBe("Oslo");
	});
});

describe("Customer Hash", () => {
	test("computeCustomerHash returns same hash for same input", () => {
		const customer: RubicCustomer = {
			customerNo: "123",
			customerType: 1,
			customerTypeName: null,
			customerName: "Test",
			email: "test@example.com",
			countryCode: null,
			mobile: "123",
			address: "Street",
			address2: null,
			zipCode: "1234",
			city: "City",
			countryName: null,
			ledgerCustomerNo: null,
		};

		const hash1 = computeCustomerHash(customer);
		const hash2 = computeCustomerHash(customer);

		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64); // SHA-256 hex string length
	});

	test("computeCustomerHash returns different hash for different input", () => {
		const customer1: RubicCustomer = {
			customerNo: "123",
			customerType: 1,
			customerTypeName: null,
			customerName: "Test",
			email: "test@example.com",
			countryCode: null,
			mobile: "123",
			address: "Street",
			address2: null,
			zipCode: "1234",
			city: "City",
			countryName: null,
			ledgerCustomerNo: null,
		};

		const customer2: RubicCustomer = {
			...customer1,
			customerName: "Different",
		};

		const hash1 = computeCustomerHash(customer1);
		const hash2 = computeCustomerHash(customer2);

		expect(hash1).not.toBe(hash2);
	});

	test("computeCustomerHash ignores non-key fields", () => {
		const customer1: RubicCustomer = {
			customerNo: "123",
			customerType: 1,
			customerTypeName: "Type A",
			customerName: "Test",
			email: "test@example.com",
			countryCode: null,
			mobile: "123",
			address: "Street",
			address2: null,
			zipCode: "1234",
			city: "City",
			countryName: null,
			ledgerCustomerNo: null,
		};

		const customer2: RubicCustomer = {
			...customer1,
			customerTypeName: "Type B", // Different but not in key fields
		};

		const hash1 = computeCustomerHash(customer1);
		const hash2 = computeCustomerHash(customer2);

		expect(hash1).toBe(hash2);
	});
});
