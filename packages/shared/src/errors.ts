/**
 * Canonical Stratum error taxonomy.
 * Every API error response is exactly: { error: { code, message, details? } }
 */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'TABLE_NOT_FOUND'
  | 'COLUMN_NOT_FOUND'
  | 'BUCKET_NOT_FOUND'
  | 'OBJECT_NOT_FOUND'
  | 'FUNCTION_NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'SQL_ERROR'
  | 'MIGRATION_ERROR'
  | 'STORAGE_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL_ERROR';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TABLE_NOT_FOUND: 404,
  COLUMN_NOT_FOUND: 404,
  BUCKET_NOT_FOUND: 404,
  OBJECT_NOT_FOUND: 404,
  FUNCTION_NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  SQL_ERROR: 400,
  MIGRATION_ERROR: 500,
  STORAGE_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,
};

export class StratumError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'StratumError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

// Backwards compatibility alias
export { StratumError as BaseForgeError };

export const err = (code: ErrorCode, message: string, details?: unknown) =>
  new StratumError(code, message, details);

export interface WireError {
  error: { code: string; message: string; details?: unknown };
}

/**
 * Converts any thrown value into a safe wire-format error.
 * In production, internal messages and stack traces are never leaked.
 */
export function toErrorResponse(
  e: unknown,
  isProduction: boolean,
): { status: number; body: WireError } {
  if (e instanceof StratumError) {
    if (isProduction && e.status >= 500) {
      return { status: e.status, body: { error: { code: e.code, message: 'An internal error occurred.' } } };
    }
    return { status: e.status, body: e.toJSON() };
  }
  const message = isProduction
    ? 'An internal error occurred.'
    : e instanceof Error
      ? e.message
      : String(e);
  return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message } } };
}
