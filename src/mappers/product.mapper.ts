import { createHash } from "node:crypto";
import type { RubicProduct } from "@/types/rubic";
import type { TripletexProduct } from "@/types/tripletex";

/**
 * Maps a Rubic ProductDTO to a Tripletex Product.
 */
export function mapRubicProductToTripletex(product: RubicProduct): TripletexProduct {
	return {
		number: product.productCode ?? undefined,
		name: product.productName ?? undefined,
		description: product.productDescription ?? undefined,
		priceExcludingVatCurrency: product.price,
		isInactive: false,
	};
}

/**
 * Computes a hash of key fields from a Rubic product for change detection.
 * The hash is based on: productCode, productName, productDescription, and price.
 */
export function computeProductHash(product: RubicProduct): string {
	const keyFields = [
		product.productCode ?? "",
		product.productName ?? "",
		product.productDescription ?? "",
		product.price.toString(),
	].join("|");

	return createHash("sha256").update(keyFields).digest("hex");
}
