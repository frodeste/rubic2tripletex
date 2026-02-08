import { z } from "zod";

/**
 * Application configuration derived from environment variables.
 * API credentials for Rubic and Tripletex are now stored per-organization
 * in Convex and managed through the Settings UI.
 */
const envSchema = z.object({
	// Convex
	NEXT_PUBLIC_CONVEX_URL: z.string().url(),

	// Auth0 (v4 SDK env var names)
	AUTH0_SECRET: z.string().min(1),
	AUTH0_DOMAIN: z.string().min(1),
	AUTH0_CLIENT_ID: z.string().min(1),
	AUTH0_CLIENT_SECRET: z.string().min(1),
	APP_BASE_URL: z.string().url().default("https://integration.uniteperformance.no"),

	// Environment
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let _config: Env | null = null;

export function getConfig(): Env {
	if (!_config) {
		_config = envSchema.parse(process.env);
	}
	return _config;
}
