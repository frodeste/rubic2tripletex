---
name: test-writing
description: Write unit tests following this project's established patterns using Bun's built-in test runner. Use when the user asks to write tests, add test coverage, create test files, or when generating tests for new or existing code. Ensures tests follow project conventions for imports, mocking, assertions, and file structure.
---

# Test Writing

This project uses **Bun's built-in test runner** -- not Jest, Vitest, or any other framework.

## Quick Reference

```typescript
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { MyModule } from "./my-module";
import type { MyType } from "@/types/my-type";
```

Run tests:

```bash
bun test                              # all tests
bun test src/sync/customers.test.ts   # specific file
bun test --coverage                   # with coverage
```

## Conventions

### File Naming and Location

- Name: `*.test.ts` (not `.spec.ts`)
- Location: colocated next to the source file (e.g., `src/clients/rubic.test.ts` tests `src/clients/rubic.ts`)

### Formatting (Biome)

- **Tabs** for indentation (not spaces)
- **Double quotes** for strings
- **Semicolons** always
- **100 char** line width

### Imports

- Use `"bun:test"` for all test utilities: `describe`, `expect`, `test`, `mock`, `beforeEach`, `afterEach`
- Use `@/` path alias for project imports (e.g., `@/mappers/customer.mapper`, `@/types/rubic`)
- Use relative imports for the module under test (e.g., `"./rubic"`)
- Use `import type` for type-only imports

### Test Structure

- Use `test()` (not `it()`)
- Group related tests with `describe()` blocks named after the module or concern
- Keep test names descriptive: `"maps all fields correctly"`, `"handles null values"`, `"throws on API error"`

## Patterns

### Pattern 1: Factory Functions for Test Data

For complex input objects, create `makeEntity()` factory functions with `Partial<T>` overrides:

```typescript
function makeInvoice(overrides?: Partial<RubicInvoice>): RubicInvoice {
	return {
		invoiceID: 1001,
		invoiceNumber: 5001,
		orderID: 2001,
		invoiceDate: "2025-06-01",
		// ... all required fields with sensible defaults ...
		...overrides,
	};
}

function makeLine(overrides?: Partial<RubicInvoiceLine>): RubicInvoiceLine {
	return {
		invoiceLineID: 1,
		productCode: "PROD-001",
		price: 499.0,
		quantity: 1,
		// ... all required fields ...
		...overrides,
	};
}
```

Use factory functions when the input type has more than 3-4 fields. For simpler types, inline the object.

### Pattern 2: Mocking `globalThis.fetch` for API Clients

Save and restore the original fetch. Use `mock()` from `bun:test` and its built-in tracking features:

```typescript
const originalFetch = globalThis.fetch;

describe("MyClient", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("fetches data correctly", async () => {
		const mockFetch = mock(async (url: string | URL | Request) => {
			return new Response(JSON.stringify([{ id: 1 }]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		});
		globalThis.fetch = mockFetch as unknown as typeof fetch;

		const result = await client.getData();
		expect(result).toHaveLength(1);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	test("throws on API error", async () => {
		const mockFetch = mock(async () => {
			return new Response("Unauthorized", { status: 401, statusText: "Unauthorized" });
		});
		globalThis.fetch = mockFetch as unknown as typeof fetch;

		expect(client.getData()).rejects.toThrow();
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});
});
```

Key details:
- Store `originalFetch` at module scope, restore in `afterEach`
- Assign `mock()` to a variable (`mockFetch`) to access its tracking properties
- Use `expect(mockFetch).toHaveBeenCalledTimes(1)` instead of manual counters
- Access call arguments via `mockFetch.mock.calls` when needed (e.g., to inspect captured URLs or headers)
- Cast mock as `unknown as typeof fetch` for type compatibility
- Return `new Response(JSON.stringify(data), { status, headers })` to simulate responses

### Pattern 3: Pure Mapper Tests

Test mappers as pure functions -- no mocking needed:

```typescript
describe("Customer Mapper", () => {
	test("maps all fields correctly", () => {
		const input: RubicCustomer = { /* full object */ };
		const result = mapRubicCustomerToTripletex(input);

		expect(result.name).toBe("Test Customer");
		expect(result.customerNumber).toBe(12345);
	});

	test("handles null values", () => {
		const input: RubicCustomer = { /* object with nulls */ };
		const result = mapRubicCustomerToTripletex(input);

		expect(result.email).toBeUndefined();
	});
});
```

### Pattern 4: Hash/Determinism Tests

For hash functions, verify determinism and sensitivity:

```typescript
test("returns same hash for same input", () => {
	const hash1 = computeHash(entity);
	const hash2 = computeHash(entity);
	expect(hash1).toBe(hash2);
	expect(hash1).toHaveLength(64); // SHA-256 hex
});

test("returns different hash for different input", () => {
	const hash1 = computeHash(entity1);
	const hash2 = computeHash(entity2);
	expect(hash1).not.toBe(hash2);
});
```

## Edge Cases to Always Cover

Every test suite should include tests for:

1. **Null/undefined fields** -- verify graceful handling, not crashes
2. **Empty arrays** -- `[]` should not throw
3. **Invalid/unexpected formats** -- e.g., non-numeric strings where numbers are expected
4. **Boundary conditions** -- empty strings, zero values, max-length data

## What NOT to Do

- **No database tests** -- tests are pure unit tests; do not import from `src/db/`
- **No `it()` calls** -- use `test()` consistently
- **No Jest/Vitest imports** -- everything comes from `"bun:test"`
- **No snapshot testing** -- use explicit assertions
- **No test utilities from npm** -- use Bun's built-in `mock()` and `expect()`

## Existing Test Files for Reference

- `src/clients/rubic.test.ts` -- API client mocking with `globalThis.fetch`
- `src/clients/tripletex.test.ts` -- API client mocking
- `src/mappers/invoice.mapper.test.ts` -- factory functions and mapper testing
- `src/mappers/product.mapper.test.ts` -- mapper testing
- `src/sync/customers.test.ts` -- mapper and hash function testing
- `src/sync/invoices.test.ts` -- sync logic testing
- `src/sync/payments.test.ts` -- sync logic testing
- `src/sync/products.test.ts` -- sync logic testing
