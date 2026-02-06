import { describe, expect, test } from "bun:test";
import { computeProductHash, mapRubicProductToTripletex } from "@/mappers/product.mapper";
import type { RubicProduct } from "@/types/rubic";

describe("Product Mapper", () => {
	const baseProduct: RubicProduct = {
		productID: 1,
		productCode: "PROD-001",
		productName: "Annual Membership",
		productDescription: "Full year membership fee",
		productGroupID: 10,
		departmentID: 5,
		price: 499.0,
	};

	test("mapRubicProductToTripletex maps all fields correctly", () => {
		const result = mapRubicProductToTripletex(baseProduct);

		expect(result.number).toBe("PROD-001");
		expect(result.name).toBe("Annual Membership");
		expect(result.description).toBe("Full year membership fee");
		expect(result.priceExcludingVatCurrency).toBe(499.0);
		expect(result.isInactive).toBe(false);
	});

	test("mapRubicProductToTripletex handles null optional fields", () => {
		const product: RubicProduct = {
			...baseProduct,
			productCode: null,
			productName: null,
			productDescription: null,
		};

		const result = mapRubicProductToTripletex(product);

		expect(result.number).toBeUndefined();
		expect(result.name).toBeUndefined();
		expect(result.description).toBeUndefined();
		expect(result.priceExcludingVatCurrency).toBe(499.0);
		expect(result.isInactive).toBe(false);
	});

	test("mapRubicProductToTripletex preserves zero price", () => {
		const product: RubicProduct = {
			...baseProduct,
			price: 0,
		};

		const result = mapRubicProductToTripletex(product);

		expect(result.priceExcludingVatCurrency).toBe(0);
	});
});

describe("Product Hash", () => {
	const baseProduct: RubicProduct = {
		productID: 1,
		productCode: "PROD-001",
		productName: "Annual Membership",
		productDescription: "Full year membership fee",
		productGroupID: 10,
		departmentID: 5,
		price: 499.0,
	};

	test("computeProductHash returns consistent hash for same input", () => {
		const hash1 = computeProductHash(baseProduct);
		const hash2 = computeProductHash(baseProduct);

		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64);
	});

	test("computeProductHash changes when name changes", () => {
		const modified: RubicProduct = {
			...baseProduct,
			productName: "Monthly Membership",
		};

		expect(computeProductHash(baseProduct)).not.toBe(computeProductHash(modified));
	});

	test("computeProductHash changes when price changes", () => {
		const modified: RubicProduct = {
			...baseProduct,
			price: 599.0,
		};

		expect(computeProductHash(baseProduct)).not.toBe(computeProductHash(modified));
	});

	test("computeProductHash ignores non-key fields", () => {
		const modified: RubicProduct = {
			...baseProduct,
			productGroupID: 999,
			departmentID: 999,
			productID: 999,
		};

		expect(computeProductHash(baseProduct)).toBe(computeProductHash(modified));
	});
});
