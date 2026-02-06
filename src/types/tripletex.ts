/**
 * Tripletex API type definitions.
 * Based on the OpenAPI spec at:
 * https://tripletex.no/v2/openapi.json
 *
 * Only the types relevant to this integration are defined here.
 */

export interface TripletexCustomer {
	id?: number;
	version?: number;
	name: string;
	organizationNumber?: string;
	customerNumber?: number;
	isSupplier?: boolean;
	isCustomer?: boolean;
	isInactive?: boolean;
	email?: string;
	invoiceEmail?: string;
	phoneNumber?: string;
	phoneNumberMobile?: string;
	postalAddress?: TripletexAddress;
	physicalAddress?: TripletexAddress;
}

export interface TripletexAddress {
	id?: number;
	addressLine1?: string;
	addressLine2?: string;
	postalCode?: string;
	city?: string;
	country?: TripletexCountry;
}

export interface TripletexCountry {
	id?: number;
}

export interface TripletexProduct {
	id?: number;
	version?: number;
	name?: string;
	number?: string;
	description?: string;
	priceExcludingVatCurrency?: number;
	priceIncludingVatCurrency?: number;
	isInactive?: boolean;
	vatType?: TripletexVatType;
}

export interface TripletexVatType {
	id?: number;
	number?: string;
	description?: string;
	percentage?: number;
}

export interface TripletexInvoice {
	id?: number;
	version?: number;
	invoiceNumber?: number;
	invoiceDate: string;
	customer: { id: number };
	orders?: Array<{ id: number }>;
	invoiceDueDate: string;
	comment?: string;
}

export interface TripletexOrder {
	id?: number;
	version?: number;
	customer: { id: number };
	deliveryDate: string;
	orderDate?: string;
	orderLines?: TripletexOrderLine[];
}

export interface TripletexOrderLine {
	id?: number;
	version?: number;
	product?: { id: number };
	description?: string;
	count?: number;
	unitPriceExcludingVatCurrency?: number;
	discount?: number;
	vatType?: { id: number };
}

export interface TripletexPayment {
	id?: number;
	version?: number;
	amount: number;
	paymentDate: string;
	paymentType?: { id: number };
}

export interface TripletexSessionToken {
	consumerToken: string;
	employeeToken: string;
	expirationDate: string;
}

export interface TripletexListResponse<T> {
	fullResultSize: number;
	from: number;
	count: number;
	versionDigest?: string;
	values: T[];
}

export interface TripletexSingleResponse<T> {
	value: T;
}
