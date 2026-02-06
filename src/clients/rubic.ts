import { logger } from "@/logger";
import type {
	RubicCompanyMember,
	RubicCustomer,
	RubicInvoice,
	RubicInvoiceTransaction,
	RubicMember,
	RubicProduct,
	RubicProductDepartment,
	RubicProductGroup,
} from "@/types/rubic";

interface RubicClientConfig {
	baseUrl: string;
	apiKey: string;
	organizationId: number;
}

/**
 * Rubic External API client.
 * All endpoints are read-only (GET) and scoped to an organization ID.
 * Supports automatic pagination to fetch all records.
 */
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
			const body = await response.text().catch(() => "");
			logger.error(`Rubic API error: ${response.status} ${response.statusText}`, "RubicClient", {
				path,
				status: response.status,
				body: body.slice(0, 500),
			});
			throw new Error(`Rubic API error: ${response.status} ${response.statusText}`);
		}

		return response.json() as Promise<T>;
	}

	/**
	 * Fetch all pages of a paginated endpoint.
	 * Rubic uses pageNo (1-based) and pageSize query parameters.
	 */
	private async fetchAllPages<T>(path: string, pageSize = 1000): Promise<T[]> {
		const allItems: T[] = [];
		let pageNo = 1;

		while (true) {
			const items = await this.request<T[]>(path, {
				pageNo: pageNo.toString(),
				pageSize: pageSize.toString(),
			});

			allItems.push(...items);

			if (items.length < pageSize) {
				break;
			}

			pageNo++;
		}

		logger.info(`Fetched ${allItems.length} items from ${path}`, "RubicClient", {
			pages: pageNo,
		});

		return allItems;
	}

	// --- Accounting Endpoints ---

	async getCustomers(): Promise<RubicCustomer[]> {
		return this.fetchAllPages<RubicCustomer>(`/accounting/${this.organizationId}/customers`);
	}

	async getProducts(): Promise<RubicProduct[]> {
		return this.fetchAllPages<RubicProduct>(`/accounting/${this.organizationId}/products`);
	}

	async getProductGroups(): Promise<RubicProductGroup[]> {
		return this.fetchAllPages<RubicProductGroup>(
			`/accounting/${this.organizationId}/productgroups`,
		);
	}

	async getDepartments(): Promise<RubicProductDepartment[]> {
		return this.fetchAllPages<RubicProductDepartment>(
			`/accounting/${this.organizationId}/departments`,
		);
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
			if (startPeriod) {
				params.startPeriod = startPeriod.toISOString();
			}
			if (endPeriod) {
				params.endPeriod = endPeriod.toISOString();
			}

			const items = await this.request<RubicInvoice[]>(path, params);
			allItems.push(...items);

			if (items.length < pageSize) {
				break;
			}
			pageNo++;
		}

		logger.info(`Fetched ${allItems.length} invoices`, "RubicClient", {
			pages: pageNo,
			startPeriod: startPeriod?.toISOString(),
			endPeriod: endPeriod?.toISOString(),
		});

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
			if (startPeriod) {
				params.startPeriod = startPeriod.toISOString();
			}
			if (endPeriod) {
				params.endPeriod = endPeriod.toISOString();
			}

			const items = await this.request<RubicInvoiceTransaction[]>(path, params);
			allItems.push(...items);

			if (items.length < pageSize) {
				break;
			}
			pageNo++;
		}

		logger.info(`Fetched ${allItems.length} invoice transactions`, "RubicClient", {
			pages: pageNo,
			startPeriod: startPeriod?.toISOString(),
			endPeriod: endPeriod?.toISOString(),
		});

		return allItems;
	}

	// --- Member Endpoints ---

	async getPersonMembers(): Promise<RubicMember[]> {
		return this.fetchAllPages<RubicMember>(`/members/${this.organizationId}/persons`);
	}

	async getCompanyMembers(): Promise<RubicCompanyMember[]> {
		return this.fetchAllPages<RubicCompanyMember>(`/members/${this.organizationId}/companies`);
	}
}
