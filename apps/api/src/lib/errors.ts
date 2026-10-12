import type { CommonErrorResponse } from "@workspace/contracts"

/**
 * AppError hierarchy + per-route error mapping, shaped to emit the LMS
 * Common.ErrorResponse envelope exactly (spec/shared/common.tsp):
 * `{ error: { code, message, details?, requestId } }`.
 * Pattern adapted from the vamios-core skeleton.
 */
export class AppError extends Error {
  code: string
  statusCode: number

  constructor(code: string, message: string, statusCode = 500) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.name = "AppError"
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super("notFound", id ? `${resource} with id '${id}' not found` : `${resource} not found`, 404)
    this.name = "NotFoundError"
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("conflict", message, 409)
    this.name = "ConflictError"
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super("forbidden", message, 403)
    this.name = "ForbiddenError"
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("unauthorized", message, 401)
    this.name = "UnauthorizedError"
  }
}

export class ValidationError extends AppError {
  details?: Array<{ field: string; code: string; message: string }>

  constructor(message: string, details?: Array<{ field: string; code: string; message: string }>) {
    super("validationError", message, 400)
    this.details = details
    this.name = "ValidationError"
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super("rateLimitExceeded", message, 429)
    this.name = "RateLimitError"
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super("serviceUnavailable", message, 503)
    this.name = "ServiceUnavailableError"
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super("badRequest", message, 400)
    this.name = "BadRequestError"
  }
}

export interface ErrorResult {
  body: CommonErrorResponse
  statusCode: number
}

export function handleError(error: unknown, requestId: string): ErrorResult {
  if (error instanceof ValidationError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
    }
  }

  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
        },
      },
    }
  }

  // Fastify-generated errors (malformed JSON body, unsupported content
  // type, rate limiting, …) carry their own statusCode — map them into the
  // standard envelope instead of the 500 default below.
  const fastifyStatus = (error as { statusCode?: number })?.statusCode
  if (typeof fastifyStatus === "number" && fastifyStatus >= 400 && fastifyStatus < 500) {
    const defaultCode = fastifyStatus === 429 ? "rateLimitExceeded" : "badRequest"
    const code = (error as { code?: string })?.code ?? defaultCode
    return {
      statusCode: fastifyStatus,
      body: {
        error: {
          code,
          message: error instanceof Error ? error.message : "Invalid request",
          requestId,
        },
      },
    }
  }

  console.error("Unhandled error:", error)
  return {
    statusCode: 500,
    body: {
      error: {
        code: "internalError",
        message: "An unexpected error occurred",
        requestId,
      },
    },
  }
}
