import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
};

export default withSentryConfig(nextConfig, {
	// Suppress source map upload logs during build
	silent: true,

	// Upload source maps for better stack traces
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,

	// Automatically tree-shake Sentry logger statements
	disableLogger: true,
});
