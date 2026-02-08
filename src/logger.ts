import pino from "pino";

const level = process.env["LOG_LEVEL"] ?? "info";
const isDev = process.env["NODE_ENV"] !== "production";

const options: pino.LoggerOptions = {
	name: "REPLACE_ME",
	level,
};

export const logger: pino.Logger = isDev
	? pino(
			options,
			pino.transport({
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "HH:MM:ss",
					ignore: "pid,hostname",
				},
			}),
		)
	: pino(options);

/**
 * Create a child logger for a specific module.
 *
 * @example
 * const log = createLogger("agent");
 * log.info({ sessionId }, "Starting agent loop");
 */
export function createLogger(component: string): pino.Logger {
	return logger.child({ component });
}
