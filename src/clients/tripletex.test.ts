import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { TripletexClient } from "./tripletex";

const originalFetch = globalThis.fetch;

describe("TripletexClient", () => {
	let client: TripletexClient;

	beforeEach(() => {
		client = new TripletexClient({
			baseUrl: "https://tripletex.test/v2",
			consumerToken: "test-consumer",
			employeeToken: "test-employee",
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function mockFetchWithSession() {
		let sessionCreated = false;

		globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
			const urlStr = url.toString();

			// Session creation
			if (urlStr.includes("/token/session/:create")) {
				sessionCreated = true;
				return new Response(JSON.stringify({ value: { token: "test-session-token" } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Other requests - check auth header
			if (!sessionCreated) {
				return new Response("Unauthorized", { status: 401 });
			}

			const headers = new Headers(init?.headers);
			const auth = headers.get("Authorization");
			expect(auth).toBe(`Basic ${btoa("0:test-session-token")}`);

			return new Response(JSON.stringify({ fullResultSize: 0, from: 0, count: 0, values: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as typeof fetch;
	}

	test("creates session before making requests", async () => {
		let requestCount = 0;

		globalThis.fetch = mock(async (url: string | URL | Request) => {
			requestCount++;
			const urlStr = url.toString();

			if (urlStr.includes("/token/session/:create")) {
				return new Response(JSON.stringify({ value: { token: "test-token" } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			return new Response(JSON.stringify({ fullResultSize: 0, from: 0, count: 0, values: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as typeof fetch;

		await client.searchCustomers({});

		// 1 session creation + 1 actual request
		expect(requestCount).toBe(2);
	});

	test("reuses session for subsequent requests", async () => {
		let sessionCalls = 0;

		globalThis.fetch = mock(async (url: string | URL | Request) => {
			const urlStr = url.toString();

			if (urlStr.includes("/token/session/:create")) {
				sessionCalls++;
				return new Response(JSON.stringify({ value: { token: "test-token" } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			return new Response(JSON.stringify({ fullResultSize: 0, from: 0, count: 0, values: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as typeof fetch;

		await client.searchCustomers({});
		await client.searchProducts({});

		expect(sessionCalls).toBe(1);
	});

	test("getCustomerByNumber returns null when not found", async () => {
		mockFetchWithSession();

		const customer = await client.getCustomerByNumber(99999);
		expect(customer).toBeNull();
	});

	test("createCustomer sends POST with body", async () => {
		let capturedMethod = "";
		let capturedBody = "";

		globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
			const urlStr = url.toString();

			if (urlStr.includes("/token/session/:create")) {
				return new Response(JSON.stringify({ value: { token: "test-token" } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			capturedMethod = init?.method ?? "";
			capturedBody = init?.body as string;

			return new Response(JSON.stringify({ value: { id: 1, name: "Test Customer" } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as typeof fetch;

		await client.createCustomer({
			name: "Test Customer",
			isCustomer: true,
		});

		expect(capturedMethod).toBe("POST");
		expect(JSON.parse(capturedBody)).toEqual({
			name: "Test Customer",
			isCustomer: true,
		});
	});

	test("throws on API error", async () => {
		globalThis.fetch = mock(async (url: string | URL | Request) => {
			const urlStr = url.toString();

			if (urlStr.includes("/token/session/:create")) {
				return new Response(JSON.stringify({ value: { token: "test-token" } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			return new Response("Internal Server Error", {
				status: 500,
				statusText: "Internal Server Error",
			});
		}) as typeof fetch;

		expect(client.searchCustomers({})).rejects.toThrow(
			"Tripletex API error: 500 Internal Server Error",
		);
	});
});
