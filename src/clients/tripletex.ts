import { logger } from "@/logger";
import type {
	TripletexCustomer,
	TripletexInvoice,
	TripletexListResponse,
	TripletexOrder,
	TripletexPayment,
	TripletexProduct,
	TripletexSingleResponse,
} from "@/types/tripletex";

interface TripletexClientConfig {
	baseUrl: string;
	consumerToken: string;
	employeeToken: string;
}

/**
 * Tripletex API client with session-based authentication.
 * Sessions are created via consumer + employee tokens and cached until expiry.
 */
export class TripletexClient {
	private baseUrl: string;
	private consumerToken: string;
	private employeeToken: string;
	private sessionToken: string | null = null;
	private sessionExpiresAt: Date | null = null;

	constructor(config: TripletexClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, "");
		this.consumerToken = config.consumerToken;
		this.employeeToken = config.employeeToken;
	}

	// --- Session Management ---

	private async ensureSession(): Promise<string> {
		if (this.sessionToken && this.sessionExpiresAt && this.sessionExpiresAt > new Date()) {
			return this.sessionToken;
		}

		logger.info("Creating new Tripletex session", "TripletexClient");

		const expirationDate = new Date();
		expirationDate.setDate(expirationDate.getDate() + 1);
		const expirationStr = expirationDate.toISOString().split("T")[0];

		const url = new URL(`${this.baseUrl}/token/session/:create`);
		url.searchParams.set("consumerToken", this.consumerToken);
		url.searchParams.set("employeeToken", this.employeeToken);
		url.searchParams.set("expirationDate", expirationStr);

		const response = await fetch(url.toString(), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			logger.error(`Tripletex session creation failed: ${response.status}`, "TripletexClient", {
				body: body.slice(0, 500),
			});
			throw new Error(`Tripletex session creation failed: ${response.status}`);
		}

		const data = (await response.json()) as TripletexSingleResponse<{
			token: string;
		}>;

		this.sessionToken = data.value.token;
		this.sessionExpiresAt = expirationDate;

		logger.info("Tripletex session created", "TripletexClient", {
			expiresAt: expirationStr,
		});

		return this.sessionToken;
	}

	private async request<T>(
		method: string,
		path: string,
		options?: {
			params?: Record<string, string>;
			body?: unknown;
		},
	): Promise<T> {
		const token = await this.ensureSession();

		const url = new URL(`${this.baseUrl}${path}`);
		if (options?.params) {
			for (const [key, value] of Object.entries(options.params)) {
				url.searchParams.set(key, value);
			}
		}

		const headers: Record<string, string> = {
			Authorization: `Basic ${btoa(`0:${token}`)}`,
			Accept: "application/json",
		};

		if (options?.body) {
			headers["Content-Type"] = "application/json";
		}

		const response = await fetch(url.toString(), {
			method,
			headers,
			body: options?.body ? JSON.stringify(options.body) : undefined,
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			logger.error(
				`Tripletex API error: ${response.status} ${response.statusText}`,
				"TripletexClient",
				{
					method,
					path,
					status: response.status,
					body: body.slice(0, 500),
				},
			);
			throw new Error(`Tripletex API error: ${response.status} ${response.statusText}`);
		}

		return response.json() as Promise<T>;
	}

	// --- Customer Endpoints ---

	async searchCustomers(
		params: Record<string, string>,
	): Promise<TripletexListResponse<TripletexCustomer>> {
		return this.request<TripletexListResponse<TripletexCustomer>>("GET", "/customer", {
			params,
		});
	}

	async getCustomerByNumber(customerNumber: number): Promise<TripletexCustomer | null> {
		const result = await this.searchCustomers({
			customerNumberFrom: customerNumber.toString(),
			customerNumberTo: customerNumber.toString(),
		});
		return result.values[0] ?? null;
	}

	async createCustomer(
		customer: TripletexCustomer,
	): Promise<TripletexSingleResponse<TripletexCustomer>> {
		return this.request<TripletexSingleResponse<TripletexCustomer>>("POST", "/customer", {
			body: customer,
		});
	}

	async updateCustomer(
		id: number,
		customer: TripletexCustomer,
	): Promise<TripletexSingleResponse<TripletexCustomer>> {
		return this.request<TripletexSingleResponse<TripletexCustomer>>("PUT", `/customer/${id}`, {
			body: customer,
		});
	}

	// --- Product Endpoints ---

	async searchProducts(
		params: Record<string, string>,
	): Promise<TripletexListResponse<TripletexProduct>> {
		return this.request<TripletexListResponse<TripletexProduct>>("GET", "/product", {
			params,
		});
	}

	async getProductByNumber(productNumber: string): Promise<TripletexProduct | null> {
		const result = await this.searchProducts({ number: productNumber });
		return result.values[0] ?? null;
	}

	async createProduct(
		product: TripletexProduct,
	): Promise<TripletexSingleResponse<TripletexProduct>> {
		return this.request<TripletexSingleResponse<TripletexProduct>>("POST", "/product", {
			body: product,
		});
	}

	async updateProduct(
		id: number,
		product: TripletexProduct,
	): Promise<TripletexSingleResponse<TripletexProduct>> {
		return this.request<TripletexSingleResponse<TripletexProduct>>("PUT", `/product/${id}`, {
			body: product,
		});
	}

	// --- Order Endpoints (needed for creating invoices) ---

	async createOrder(order: TripletexOrder): Promise<TripletexSingleResponse<TripletexOrder>> {
		return this.request<TripletexSingleResponse<TripletexOrder>>("POST", "/order", {
			body: order,
		});
	}

	// --- Invoice Endpoints ---

	async searchInvoices(
		params: Record<string, string>,
	): Promise<TripletexListResponse<TripletexInvoice>> {
		return this.request<TripletexListResponse<TripletexInvoice>>("GET", "/invoice", {
			params,
		});
	}

	async createInvoiceFromOrder(
		orderId: number,
		invoiceDate: string,
	): Promise<TripletexSingleResponse<TripletexInvoice>> {
		return this.request<TripletexSingleResponse<TripletexInvoice>>(
			"POST",
			`/invoice/${orderId}/:createFromOrder`,
			{
				params: {
					invoiceDate,
					sendToCustomer: "false",
				},
			},
		);
	}

	// --- Payment Endpoints ---

	async registerPayment(
		invoiceId: number,
		payment: TripletexPayment,
	): Promise<TripletexSingleResponse<TripletexPayment>> {
		return this.request<TripletexSingleResponse<TripletexPayment>>(
			"PUT",
			`/invoice/${invoiceId}/:payment`,
			{
				body: payment,
			},
		);
	}

	// --- Payment Type Endpoints ---

	async getPaymentTypes(): Promise<TripletexListResponse<{ id: number; description: string }>> {
		return this.request<TripletexListResponse<{ id: number; description: string }>>(
			"GET",
			"/invoice/paymentType",
		);
	}
}
