type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	context?: string;
	[key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: string, meta?: Record<string, unknown>) {
	const entry: LogEntry = {
		level,
		message,
		timestamp: new Date().toISOString(),
		...(context && { context }),
		...meta,
	};

	const output = JSON.stringify(entry);

	switch (level) {
		case "error":
			console.error(output);
			break;
		case "warn":
			console.warn(output);
			break;
		case "debug":
			if (process.env.NODE_ENV === "development") {
				console.debug(output);
			}
			break;
		default:
			console.log(output);
	}
}

export const logger = {
	info: (message: string, context?: string, meta?: Record<string, unknown>) =>
		log("info", message, context, meta),
	warn: (message: string, context?: string, meta?: Record<string, unknown>) =>
		log("warn", message, context, meta),
	error: (message: string, context?: string, meta?: Record<string, unknown>) =>
		log("error", message, context, meta),
	debug: (message: string, context?: string, meta?: Record<string, unknown>) =>
		log("debug", message, context, meta),
};
