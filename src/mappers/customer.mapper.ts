import { createHash } from "node:crypto";
import type { RubicCustomer } from "@/types/rubic";
import type { TripletexAddress, TripletexCustomer } from "@/types/tripletex";

/**
 * Maps a Rubic CustomerDTO to a Tripletex Customer.
 */
export function mapRubicCustomerToTripletex(customer: RubicCustomer): TripletexCustomer {
	const tripletexCustomer: TripletexCustomer = {
		name: customer.customerName ?? "",
		isCustomer: true,
	};

	// Map customer number (parse to int if numeric)
	if (customer.customerNo) {
		const parsed = Number.parseInt(customer.customerNo, 10);
		if (!Number.isNaN(parsed)) {
			tripletexCustomer.customerNumber = parsed;
		}
	}

	// Map email to both email and invoiceEmail
	if (customer.email) {
		tripletexCustomer.email = customer.email;
		tripletexCustomer.invoiceEmail = customer.email;
	}

	// Map mobile phone
	if (customer.mobile) {
		tripletexCustomer.phoneNumberMobile = customer.mobile;
	}

	// Map address fields to postalAddress
	const hasAddress = customer.address || customer.address2 || customer.zipCode || customer.city;

	if (hasAddress) {
		const postalAddress: TripletexAddress = {};
		if (customer.address) {
			postalAddress.addressLine1 = customer.address;
		}
		if (customer.address2) {
			postalAddress.addressLine2 = customer.address2;
		}
		if (customer.zipCode) {
			postalAddress.postalCode = customer.zipCode;
		}
		if (customer.city) {
			postalAddress.city = customer.city;
		}
		tripletexCustomer.postalAddress = postalAddress;
	}

	return tripletexCustomer;
}

/**
 * Computes a hash of key customer fields for change detection.
 * Uses SHA-256 and includes all fields that affect the Tripletex mapping.
 */
export function computeCustomerHash(customer: RubicCustomer): string {
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

	const hash = createHash("sha256");
	hash.update(JSON.stringify(keyFields));
	return hash.digest("hex");
}
