/**
 * Swarm Error Utilities
 * 
 * MCP Swarm v1.2.0
 * 
 * Unified error handling helpers for consistent error message extraction
 * across all modules. Replaces scattered `catch (err: any)` patterns.
 */

/**
 * Extract error message from unknown error type.
 * Use in catch blocks instead of `(err: any) => err.message`.
 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "message" in err) {
        return String((err as { message: unknown }).message);
    }
    return String(err);
}

/**
 * Extract error stack trace from unknown error type.
 */
export function getErrorStack(err: unknown): string | undefined {
    if (err instanceof Error) return err.stack;
    return undefined;
}

/**
 * Type guard for Node.js system errors (ENOENT, EACCES, etc.)
 */
export function isNodeError(err: unknown): err is NodeJS.ErrnoException {
    return err instanceof Error && "code" in err;
}

/**
 * Wrap an unknown error into a proper Error instance.
 */
export function toError(err: unknown): Error {
    if (err instanceof Error) return err;
    return new Error(getErrorMessage(err));
}
