/**
 * Shared retry utility for API clients with exponential backoff.
 * Handles common transient errors: timeouts (408), rate limits (429), and server errors (500-504).
 */

export interface RetryOptions {
	/** Maximum number of retry attempts (default: 10) */
	maxRetries?: number;
	/** Initial delay in milliseconds before first retry (default: 1000) */
	initialDelayMs?: number;
	/** Maximum delay in milliseconds between retries (default: 30000) */
	maxDelayMs?: number;
	/** Custom function to determine if an error is retryable */
	isRetryable?: (error: unknown) => boolean;
	/** Custom function to extract retry-after hint from error (in ms) */
	getRetryAfterMs?: (error: unknown) => number | null;
	/** Label for logging (e.g., "MyAPI") */
	label?: string;
}

const DEFAULT_RETRY_OPTIONS = {
	maxRetries: 10,
	initialDelayMs: 1000,
	maxDelayMs: 30000,
} as const;

/**
 * HTTP status codes that indicate transient errors worth retrying.
 */
const RETRYABLE_STATUS_CODES = new Set([
	408, // Request Timeout
	429, // Too Many Requests (rate limit)
	500, // Internal Server Error
	502, // Bad Gateway
	503, // Service Unavailable
	504, // Gateway Timeout
]);

export function isRetryableStatusCode(statusCode: number): boolean {
	return RETRYABLE_STATUS_CODES.has(statusCode);
}

/**
 * Default error checker that handles common error shapes.
 */
export function defaultIsRetryable(error: unknown): boolean {
	if (error && typeof error === "object") {
		const status = Reflect.get(error, "status") ?? Reflect.get(error, "code");
		if (typeof status === "number" && isRetryableStatusCode(status)) {
			return true;
		}
		const statusCode = Reflect.get(error, "statusCode");
		if (typeof statusCode === "number" && isRetryableStatusCode(statusCode)) {
			return true;
		}
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		if (
			message.includes("timeout") ||
			message.includes("econnreset") ||
			message.includes("econnrefused") ||
			message.includes("socket hang up") ||
			message.includes("network") ||
			message.includes("request_timeout")
		) {
			return true;
		}
	}

	return false;
}

/**
 * Extract retry-after delay from common error response formats.
 */
export function defaultGetRetryAfterMs(error: unknown): number | null {
	if (!error || typeof error !== "object") {
		return null;
	}

	const headers = Reflect.get(error, "headers");
	if (headers && typeof headers === "object") {
		const retryAfter =
			Reflect.get(headers, "retry-after") ??
			Reflect.get(headers, "Retry-After");
		if (typeof retryAfter === "string") {
			const seconds = Number.parseInt(retryAfter, 10);
			if (!Number.isNaN(seconds)) {
				return seconds * 1000;
			}
		}
		if (typeof retryAfter === "number") {
			return retryAfter * 1000;
		}
	}

	return null;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetchData(),
 *   { label: "MyAPI" }
 * );
 * ```
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const {
		maxRetries = DEFAULT_RETRY_OPTIONS.maxRetries,
		initialDelayMs = DEFAULT_RETRY_OPTIONS.initialDelayMs,
		maxDelayMs = DEFAULT_RETRY_OPTIONS.maxDelayMs,
		isRetryable = defaultIsRetryable,
		getRetryAfterMs = defaultGetRetryAfterMs,
		label,
	} = options;

	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			if (!isRetryable(error)) {
				throw error;
			}

			if (attempt === maxRetries) {
				throw error;
			}

			const retryAfter = getRetryAfterMs(error);
			const exponentialDelay = initialDelayMs * 2 ** attempt;
			const delay = Math.min(retryAfter ?? exponentialDelay, maxDelayMs);

			const nextAttempt = attempt + 1;
			const prefix = label ? `${label}: ` : "";
			console.error(
				`${prefix}Transient error, retrying in ${delay}ms (attempt ${nextAttempt}/${maxRetries})`,
			);

			await sleep(delay);
		}
	}

	throw lastError;
}
