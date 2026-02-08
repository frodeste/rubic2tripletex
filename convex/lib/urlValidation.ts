/**
 * Allowlisted hostname patterns per provider.
 * Only URLs matching these patterns are accepted as baseUrl values.
 */
const ALLOWED_HOSTS: Record<string, RegExp[]> = {
	rubic: [
		// Production and test Rubic API
		/^rubicexternalapi(test)?\.azurewebsites\.net$/,
	],
	tripletex: [
		// Production API
		/^tripletex\.no$/,
		// Sandbox / test API
		/^api\.tripletex\.io$/,
	],
};

/**
 * Validate that a base URL is safe to use for outbound requests.
 *
 * Defends against SSRF by:
 *  1. Requiring HTTPS
 *  2. Rejecting URLs with authentication credentials
 *  3. Matching the hostname against a per-provider allowlist
 *
 * Throws a descriptive error if validation fails.
 */
export function validateBaseUrl(baseUrl: string, provider: string): void {
	let parsed: URL;
	try {
		parsed = new URL(baseUrl);
	} catch {
		throw new Error(`Invalid base URL: could not parse "${baseUrl}".`);
	}

	// 1. Must be HTTPS
	if (parsed.protocol !== "https:") {
		throw new Error("Base URL must use HTTPS.");
	}

	// 2. Must not include credentials in the URL
	if (parsed.username || parsed.password) {
		throw new Error("Base URL must not contain embedded credentials.");
	}

	// 3. Hostname must be in the allowlist for this provider
	const patterns = ALLOWED_HOSTS[provider];
	if (!patterns) {
		throw new Error(`Unknown provider "${provider}".`);
	}

	const hostname = parsed.hostname.toLowerCase();
	const allowed = patterns.some((re) => re.test(hostname));
	if (!allowed) {
		const names = patterns.map((re) => re.source).join(", ");
		throw new Error(
			`Base URL hostname "${hostname}" is not allowed for provider "${provider}". ` +
				`Expected a hostname matching one of: ${names}`,
		);
	}
}
