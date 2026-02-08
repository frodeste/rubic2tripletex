/**
 * Data mapping and hashing functions for use in Convex actions.
 * Mirrors src/mappers/ but is self-contained within convex/ directory.
 */
import type {
	RubicCustomer,
	RubicInvoice,
	RubicProduct,
} from "./rubicClient";
import type {
	TripletexCustomer,
	TripletexOrder,
	TripletexOrderLine,
	TripletexProduct,
} from "./tripletexClient";

// --- Customer Mapping ---

export function mapRubicCustomerToTripletex(customer: RubicCustomer): TripletexCustomer {
	const result: TripletexCustomer = {
		name: customer.customerName ?? "",
		isCustomer: true,
	};

	if (customer.customerNo) {
		const parsed = Number.parseInt(customer.customerNo, 10);
		if (!Number.isNaN(parsed)) {
			result.customerNumber = parsed;
		}
	}

	if (customer.email) {
		result.email = customer.email;
		result.invoiceEmail = customer.email;
	}

	if (customer.mobile) {
		result.phoneNumberMobile = customer.mobile;
	}

	const hasAddress = customer.address || customer.address2 || customer.zipCode || customer.city;
	if (hasAddress) {
		result.postalAddress = {};
		if (customer.address) result.postalAddress.addressLine1 = customer.address;
		if (customer.address2) result.postalAddress.addressLine2 = customer.address2;
		if (customer.zipCode) result.postalAddress.postalCode = customer.zipCode;
		if (customer.city) result.postalAddress.city = customer.city;
	}

	return result;
}

export async function computeCustomerHash(customer: RubicCustomer): Promise<string> {
	const keyFields = {
		customerNo: customer.customerNo,
		customerName: customer.customerName,
		email: customer.email,
		mobile: customer.mobile,
		address: customer.address,
		address2: customer.address2,
		zipCode: customer.zipCode,
		city: customer.city,
	};

	const data = new TextEncoder().encode(JSON.stringify(keyFields));
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Product Mapping ---

export function mapRubicProductToTripletex(product: RubicProduct): TripletexProduct {
	return {
		number: product.productCode ?? undefined,
		name: product.productName ?? undefined,
		description: product.productDescription ?? undefined,
		priceExcludingVatCurrency: product.price,
		isInactive: false,
	};
}

export async function computeProductHash(product: RubicProduct): Promise<string> {
	const keyFields = [
		product.productCode ?? "",
		product.productName ?? "",
		product.productDescription ?? "",
		product.price.toString(),
	].join("|");

	const data = new TextEncoder().encode(keyFields);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Invoice Mapping ---

export function mapRubicInvoiceToTripletexOrder(
	invoice: RubicInvoice,
	tripletexCustomerId: number,
	productMappings: Map<string, number>,
): TripletexOrder {
	const orderLines: TripletexOrderLine[] = [];

	if (invoice.invoiceLines && invoice.invoiceLines.length > 0) {
		for (const line of invoice.invoiceLines) {
			const productCode = line.productCode;
			if (!productCode) continue;

			const tripletexProductId = productMappings.get(productCode);
			if (!tripletexProductId) continue;

			const descriptionParts: string[] = [];
			if (line.productName) descriptionParts.push(line.productName);
			if (line.specification) descriptionParts.push(line.specification);
			const description =
				descriptionParts.length > 0 ? descriptionParts.join(" - ") : undefined;

			const orderLine: TripletexOrderLine = {
				product: { id: tripletexProductId },
				count: line.quantity,
				unitPriceExcludingVatCurrency: line.price,
				description,
			};

			if (line.discount > 0) {
				orderLine.discount = line.discount;
			}

			orderLines.push(orderLine);
		}
	}

	return {
		customer: { id: tripletexCustomerId },
		deliveryDate: invoice.invoiceDate,
		orderDate: invoice.invoiceDate,
		orderLines: orderLines.length > 0 ? orderLines : undefined,
	};
}
