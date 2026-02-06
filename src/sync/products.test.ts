import { describe, expect, test } from "bun:test";
import { computeProductHash, mapRubicProductToTripletex } from "@/mappers/product.mapper";
import type { RubicProduct } from "@/types/rubic";

describe("Product Mapper", () => {
	test("mapRubicProductToTripletex maps fields correctly", () => {
		const rubicProduct: RubicProduct = {
			productID: 123,
			productCode: "PROD-001",
			productName: "Test Product",
			productDescription: "A test product description",
			productGroupID: 1,
			departmentID: 2,
			price: 99.99,
		};

		const tripletexProduct = mapRubicProductToTripletex(rubicProduct);

		expect(tripletexProduct.number).toBe("PROD-001");
		expect(tripletexProduct.name).toBe("Test Product");
		expect(tripletexProduct.description).toBe("A test product description");
		expect(tripletexProduct.priceExcludingVatCurrency).toBe(99.99);
		expect(tripletexProduct.isInactive).toBe(false);
	});

	test("mapRubicProductToTripletex handles null values", () => {
		const rubicProduct: RubicProduct = {
			productID: 456,
			productCode: null,
			productName: null,
			productDescription: null,
			productGroupID: 1,
			departmentID: null,
			price: 0,
		};

		const tripletexProduct = mapRubicProductToTripletex(rubicProduct);

		expect(tripletexProduct.number).toBeUndefined();
		expect(tripletexProduct.name).toBeUndefined();
		expect(tripletexProduct.description).toBeUndefined();
		expect(tripletexProduct.priceExcludingVatCurrency).toBe(0);
		expect(tripletexProduct.isInactive).toBe(false);
	});

	test("computeProductHash returns same hash for same input", () => {
		const product1: RubicProduct = {
			productID: 1,
			productCode: "PROD-001",
			productName: "Test Product",
			productDescription: "Description",
			productGroupID: 1,
			departmentID: 1,
			price: 100.0,
		};

		const product2: RubicProduct = {
			productID: 1,
			productCode: "PROD-001",
			productName: "Test Product",
			productDescription: "Description",
			productGroupID: 1,
			departmentID: 1,
			price: 100.0,
		};

		const hash1 = computeProductHash(product1);
		const hash2 = computeProductHash(product2);

		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64); // SHA-256 produces 64-character hex string
	});

	test("computeProductHash returns different hash for different productCode", () => {
		const product1: RubicProduct = {
			productID: 1,
			productCode: "PROD-001",
			productName: "Test Product",
			productDescription: "Description",
			productGroupID: 1,
			departmentID: 1,
			price: 100.0,
		};

		const product2: RubicProduct = {
			productID: 1,
			productCode: "PROD-002",
			productName: "Test Product",
			productDescription: "Description",
			productGroupID: 1,
			departmentID: 1,
			price: 100.0,
		};

		const hash1 = computeProductHash(product1);
		const hash2 = computeProductHash(product2);

		expect(hash1).not.toBe(hash2);
	});

	test("computeProductHash returns different hash for different productName", () => {
		const product1: RubicProduct = {
			productID: 1,
			productCode: "PROD-001",
			productName: "Test Product",
			productDescription: "Description",
			productGroupID: 1,
			departmentID: 1,
			price: 100.0,
		};

		const product2: RubicProduct = {
			productID: 1,
			productCode: "PROD-001",
			productName: "Different Product",
			productDescription: "Description",
			productGroupID: 1,
			departmentID: 1,
			price: 100.0,
		};

		const hash1 = computeProductHash(product1);
		const hash2 = computeProductHash(product2);

		expect(hash1).not.toBe(hash2);
	});

	test("computeProductHash returns different hash for different price", () => {
		const product1: RubicProduct = {
			productID: 1,
			productCode: "PROD-001",
			productName: "Test Product",
			productDescription: "Description",
			productGroupID: 1,
			departmentID: 1,
			price: 100.0,
		};

		const product2: RubicProduct = {
			productID: 1,
			productCode: "PROD-001",
			productName: "Test Product",
			productDescription: "Description",
			productGroupID: 1,
			departmentID: 1,
			price: 200.0,
		};

		const hash1 = computeProductHash(product1);
		const hash2 = computeProductHash(product2);

		expect(hash1).not.toBe(hash2);
	});

	test("computeProductHash handles null values consistently", () => {
		const product1: RubicProduct = {
			productID: 1,
			productCode: null,
			productName: null,
			productDescription: null,
			productGroupID: 1,
			departmentID: null,
			price: 0,
		};

		const product2: RubicProduct = {
			productID: 2,
			productCode: null,
			productName: null,
			productDescription: null,
			productGroupID: 2,
			departmentID: null,
			price: 0,
		};

		const hash1 = computeProductHash(product1);
		const hash2 = computeProductHash(product2);

		expect(hash1).toBe(hash2);
	});
});
