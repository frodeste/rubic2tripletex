/**
 * Tripletex API client for use in Convex actions.
 * Mirrors src/clients/tripletex.ts but is self-contained within the convex/ directory.
 */

export interface TripletexClientConfig {
	baseUrl: string;
	consumerToken: string;
	employeeToken: string;
}

export interface TripletexCustomer {
	id?: number;
	version?: number;
	name: string;
	customerNumber?: number;
	isCustomer?: boolean;
	email?: string;
	invoiceEmail?: string;
	phoneNumberMobile?: string;
	postalAddress?: {
		addressLine1?: string;
		addressLine2?: string;
		postalCode?: string;
		city?: string;
	};
}

export interface TripletexProduct {
	id?: number;
	version?: number;
	name?: string;
	number?: string;
	description?: string;
	priceExcludingVatCurrency?: number;
	isInactive?: boolean;
}

export interface TripletexOrder {
	id?: number;
	customer: { id: number };
	deliveryDate: string;
	orderDate?: string;
	orderLines?: TripletexOrderLine[];
}

export interface TripletexOrderLine {
	product?: { id: number };
	description?: string;
	count?: number;
	unitPriceExcludingVatCurrency?: number;
	discount?: number;
}

export interface TripletexInvoice {
	id?: number;
	version?: number;
	invoiceNumber?: number;
}

export interface TripletexPayment {
	amount: number;
	paymentDate: string;
}

interface SingleResponse<T> {
	value: T;
}

interface ListResponse<T> {
	fullResultSize: number;
	from: number;
	count: number;
	values: T[];
}

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

	private async ensureSession(): Promise<string> {
		if (this.sessionToken && this.sessionExpiresAt && this.sessionExpiresAt > new Date()) {
			return this.sessionToken;
		}

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
			throw new Error(`Tripletex session creation failed: ${response.status}`);
		}

		const data = (await response.json()) as SingleResponse<{ token: string }>;
		this.sessionToken = data.value.token;
		this.sessionExpiresAt = expirationDate;

		return this.sessionToken;
	}

	private async request<T>(
		method: string,
		path: string,
		options?: { params?: Record<string, string>; body?: unknown },
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
			throw new Error(`Tripletex API error: ${response.status} ${response.statusText}`);
		}

		return response.json() as Promise<T>;
	}

	// --- Customer ---

	async getCustomerByNumber(customerNumber: number): Promise<TripletexCustomer | null> {
		const result = await this.request<ListResponse<TripletexCustomer>>("GET", "/customer", {
			params: {
				customerNumberFrom: customerNumber.toString(),
				customerNumberTo: customerNumber.toString(),
			},
		});
		return result.values[0] ?? null;
	}

	async createCustomer(customer: TripletexCustomer): Promise<SingleResponse<TripletexCustomer>> {
		return this.request<SingleResponse<TripletexCustomer>>("POST", "/customer", {
			body: customer,
		});
	}

	async updateCustomer(
		id: number,
		customer: TripletexCustomer,
	): Promise<SingleResponse<TripletexCustomer>> {
		return this.request<SingleResponse<TripletexCustomer>>("PUT", `/customer/${id}`, {
			body: customer,
		});
	}

	// --- Product ---

	async getProductByNumber(productNumber: string): Promise<TripletexProduct | null> {
		const result = await this.request<ListResponse<TripletexProduct>>("GET", "/product", {
			params: { number: productNumber },
		});
		return result.values[0] ?? null;
	}

	async createProduct(product: TripletexProduct): Promise<SingleResponse<TripletexProduct>> {
		return this.request<SingleResponse<TripletexProduct>>("POST", "/product", {
			body: product,
		});
	}

	async updateProduct(
		id: number,
		product: TripletexProduct,
	): Promise<SingleResponse<TripletexProduct>> {
		return this.request<SingleResponse<TripletexProduct>>("PUT", `/product/${id}`, {
			body: product,
		});
	}

	// --- Order & Invoice ---

	async createOrder(order: TripletexOrder): Promise<SingleResponse<TripletexOrder>> {
		return this.request<SingleResponse<TripletexOrder>>("POST", "/order", { body: order });
	}

	async createInvoiceFromOrder(
		orderId: number,
		invoiceDate: string,
	): Promise<SingleResponse<TripletexInvoice>> {
		return this.request<SingleResponse<TripletexInvoice>>(
			"POST",
			`/invoice/${orderId}/:createFromOrder`,
			{
				params: { invoiceDate, sendToCustomer: "false" },
			},
		);
	}

	// --- Payment ---

	async registerPayment(
		invoiceId: number,
		payment: TripletexPayment,
	): Promise<SingleResponse<TripletexPayment>> {
		return this.request<SingleResponse<TripletexPayment>>("PUT", `/invoice/${invoiceId}/:payment`, {
			body: payment,
		});
	}

	// --- Departments ---

	async getDepartments(): Promise<ListResponse<{ id: number; number?: string; name?: string }>> {
		return this.request<ListResponse<{ id: number; number?: string; name?: string }>>(
			"GET",
			"/department",
			{ params: { count: "1000" } },
		);
	}
}
