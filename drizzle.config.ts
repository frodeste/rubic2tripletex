import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL_UNPOOLED) {
	throw new Error("DATABASE_URL_UNPOOLED is required for migrations");
}

export default defineConfig({
	out: "./src/db/migrations",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		// Use unpooled connection for migrations (pgbouncer doesn't support DDL)
		url: process.env.DATABASE_URL_UNPOOLED,
	},
});
