/**
 * Rubic External API client for use in Convex actions.
 * Mirrors src/clients/rubic.ts but is self-contained within the convex/ directory.
 */

export interface RubicClientConfig {
	baseUrl: string;
	apiKey: string;
	organizationId: number;
}

export interface RubicCustomer {
	customerNo: string | null;
	customerType: number;
	customerTypeName: string | null;
	customerName: string | null;
	email: string | null;
	countryCode: string | null;
	mobile: string | null;
	address: string | null;
	address2: string | null;
	zipCode: string | null;
	city: string | null;
	countryName: string | null;
	ledgerCustomerNo: string | null;
}

export interface RubicProduct {
	productID: number;
	productCode: string | null;
	productName: string | null;
	productDescription: string | null;
	productGroupID: number;
	departmentID: number | null;
	price: number;
}

export interface RubicInvoiceLine {
	invoiceLineID: number;
	productID: number;
	productCode: string | null;
	productName: string | null;
	productGroupName: string | null;
	accountNumber: string | null;
	departmentID: number | null;
	departmentNumber: string | null;
	departmentName: string | null;
	price: number;
	specification: string | null;
	quantity: number;
	discountPercentage: number;
	discount: number;
	taxPercentage: number;
	netTotal: number;
	tax: number;
	grossTotal: number;
}

export interface RubicInvoice {
	customer: RubicCustomer;
	invoiceID: number;
	invoiceNumber: number;
	orderID: number;
	invoiceDate: string;
	sentDate: string;
	dueDate: string;
	netTotal: number;
	taxTotal: number;
	grossTotal: number;
	balance: number;
	paidAmount: number;
	totalAmount: number;
	invoiceLines: RubicInvoiceLine[] | null;
}

export interface RubicInvoiceTransaction {
	invoiceTransactionID: number;
	invoiceID: number;
	invoiceNumber: number;
	paymentDate: string;
	paidAmount: number;
	paymentFee: number;
	vatPaymentFee: number;
	payoutAmount: number;
}

export interface RubicDepartment {
	productDepartmentID: number;
	productDepartmentNumber: string | null;
	productDepartmentName: string | null;
	organizationID: number | null;
}

export class RubicClient {
	private baseUrl: string;
	private apiKey: string;
	private organizationId: number;

	constructor(config: RubicClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, "");
		this.apiKey = config.apiKey;
		this.organizationId = config.organizationId;
	}

	private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
		const url = new URL(`${this.baseUrl}${path}`);
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				url.searchParams.set(key, value);
			}
		}

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Rubic API error: ${response.status} ${response.statusText}`);
		}

		return response.json() as Promise<T>;
	}

	private async fetchAllPages<T>(path: string, pageSize = 1000): Promise<T[]> {
		const allItems: T[] = [];
		let pageNo = 1;

		while (true) {
			const items = await this.request<T[]>(path, {
				pageNo: pageNo.toString(),
				pageSize: pageSize.toString(),
			});

			allItems.push(...items);
			if (items.length < pageSize) break;
			pageNo++;
		}

		return allItems;
	}

	async getCustomers(): Promise<RubicCustomer[]> {
		return this.fetchAllPages<RubicCustomer>(`/accounting/${this.organizationId}/customers`);
	}

	async getProducts(): Promise<RubicProduct[]> {
		return this.fetchAllPages<RubicProduct>(`/accounting/${this.organizationId}/products`);
	}

	async getDepartments(): Promise<RubicDepartment[]> {
		return this.fetchAllPages<RubicDepartment>(`/accounting/${this.organizationId}/departments`);
	}

	async getInvoices(startPeriod?: Date, endPeriod?: Date): Promise<RubicInvoice[]> {
		const path = `/accounting/${this.organizationId}/invoices`;
		const allItems: RubicInvoice[] = [];
		let pageNo = 1;
		const pageSize = 1000;

		while (true) {
			const params: Record<string, string> = {
				pageNo: pageNo.toString(),
				pageSize: pageSize.toString(),
			};
			if (startPeriod) params.startPeriod = startPeriod.toISOString();
			if (endPeriod) params.endPeriod = endPeriod.toISOString();

			const items = await this.request<RubicInvoice[]>(path, params);
			allItems.push(...items);
			if (items.length < pageSize) break;
			pageNo++;
		}

		return allItems;
	}

	async getInvoiceTransactions(
		startPeriod?: Date,
		endPeriod?: Date,
	): Promise<RubicInvoiceTransaction[]> {
		const path = `/accounting/${this.organizationId}/invoices/transactions`;
		const allItems: RubicInvoiceTransaction[] = [];
		let pageNo = 1;
		const pageSize = 1000;

		while (true) {
			const params: Record<string, string> = {
				pageNo: pageNo.toString(),
				pageSize: pageSize.toString(),
			};
			if (startPeriod) params.startPeriod = startPeriod.toISOString();
			if (endPeriod) params.endPeriod = endPeriod.toISOString();

			const items = await this.request<RubicInvoiceTransaction[]>(path, params);
			allItems.push(...items);
			if (items.length < pageSize) break;
			pageNo++;
		}

		return allItems;
	}
}
