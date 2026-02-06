import { z } from "zod";

const envSchema = z.object({
	// Database
	DATABASE_URL: z.string().url(),
	DATABASE_URL_UNPOOLED: z.string().url(),

	// Rubic API
	RUBIC_API_BASE_URL: z.string().url().default("https://rubicexternalapitest.azurewebsites.net"),
	RUBIC_API_KEY: z.string().min(1),
	RUBIC_ORGANIZATION_ID: z.coerce.number().int().positive(),

	// Tripletex API
	TRIPLETEX_API_BASE_URL: z.string().url().default("https://tripletex.no/v2"),
	TRIPLETEX_CONSUMER_TOKEN: z.string().min(1),
	TRIPLETEX_EMPLOYEE_TOKEN: z.string().min(1),

	// Auth0 (v4 SDK env var names)
	AUTH0_SECRET: z.string().min(1),
	AUTH0_DOMAIN: z.string().min(1),
	AUTH0_CLIENT_ID: z.string().min(1),
	AUTH0_CLIENT_SECRET: z.string().min(1),
	APP_BASE_URL: z.string().url().default("https://integration.uniteperformance.no"),

	// Vercel Cron
	CRON_SECRET: z.string().min(1).optional(),

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

/**
 * Get a partial config for cases where not all env vars are available
 * (e.g., during build time or in cron endpoints that only need specific vars).
 */
export function getPartialConfig() {
	return {
		databaseUrl: process.env.DATABASE_URL,
		cronSecret: process.env.CRON_SECRET,
		nodeEnv: process.env.NODE_ENV ?? "development",
	};
}
