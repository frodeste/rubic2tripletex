import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

	// Performance monitoring
	tracesSampleRate: 1.0,

	// Session replay for debugging UI issues
	replaysSessionSampleRate: 0.1,
	replaysOnErrorSampleRate: 1.0,

	integrations: [Sentry.replayIntegration()],

	// Only enable in production
	enabled: process.env.NODE_ENV === "production",
});
