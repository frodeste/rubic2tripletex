import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { RubicClient } from "./rubic";

const originalFetch = globalThis.fetch;

describe("RubicClient", () => {
	let client: RubicClient;

	beforeEach(() => {
		client = new RubicClient({
			baseUrl: "https://rubic-api.test",
			apiKey: "test-api-key",
			organizationId: 123,
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("getCustomers fetches all pages", async () => {
		const page1 = Array.from({ length: 1000 }, (_, i) => ({
			customerNo: `C${i}`,
			customerType: 1,
			customerName: `Customer ${i}`,
		}));
		const page2 = [{ customerNo: "C1000", customerType: 1, customerName: "Last" }];

		let callCount = 0;
		globalThis.fetch = mock(async (url: string | URL | Request) => {
			callCount++;
			const urlStr = url.toString();
			const data = urlStr.includes("pageNo=1") ? page1 : page2;
			return new Response(JSON.stringify(data), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;

		const customers = await client.getCustomers();

		expect(customers).toHaveLength(1001);
		expect(callCount).toBe(2);
	});

	test("getCustomers sends correct auth header", async () => {
		let capturedHeaders: Headers | null = null;

		globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
			capturedHeaders = new Headers(init?.headers);
			return new Response(JSON.stringify([]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;

		await client.getCustomers();

		// biome-ignore lint/style/noNonNullAssertion: guaranteed set by mock after await
		expect(capturedHeaders!.get("Authorization")).toBe("Bearer test-api-key");
	});

	test("getInvoices passes date range params", async () => {
		let capturedUrl = "";

		globalThis.fetch = mock(async (url: string | URL | Request) => {
			capturedUrl = url.toString();
			return new Response(JSON.stringify([]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;

		const start = new Date("2025-01-01T00:00:00Z");
		const end = new Date("2025-01-31T23:59:59Z");
		await client.getInvoices(start, end);

		expect(capturedUrl).toContain("startPeriod=");
		expect(capturedUrl).toContain("endPeriod=");
	});

	test("throws on API error", async () => {
		globalThis.fetch = mock(async () => {
			return new Response("Unauthorized", { status: 401, statusText: "Unauthorized" });
		}) as unknown as typeof fetch;

		expect(client.getCustomers()).rejects.toThrow("Rubic API error: 401 Unauthorized");
	});
});
