import type { FastifyReply, FastifyRequest } from "fastify"
import type { ZodSchema } from "zod"
import { ZodError } from "zod"

/**
 * Zod preValidation hooks — the integration point for the schemas
 * generated into @workspace/contracts/zod. Failures emit the LMS
 * Common.ErrorResponse envelope (spec/shared/common.tsp).
 * Pattern adapted from the vamios-core skeleton.
 */
function validationErrorResponse(request: FastifyRequest, message: string, error: ZodError) {
  return {
    error: {
      code: "validationError" as const,
      message,
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
      requestId: request.id,
    },
  }
}

/** Validate request body against a Zod schema. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (request: FastifyRequest, reply: FastifyReply, done: () => void): void => {
    try {
      request.body = schema.parse(request.body)
      done()
    } catch (error) {
      if (error instanceof ZodError) {
        reply.status(400).send(validationErrorResponse(request, "Invalid request body", error))
      } else {
        reply.status(500).send({
          error: {
            code: "internalError",
            message: "Validation failed",
            requestId: request.id,
          },
        })
      }
    }
  }
}

/** Validate request query parameters against a Zod schema. */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (request: FastifyRequest, reply: FastifyReply, done: () => void): void => {
    try {
      request.query = schema.parse(request.query)
      done()
    } catch (error) {
      if (error instanceof ZodError) {
        reply.status(400).send(validationErrorResponse(request, "Invalid query parameters", error))
      } else {
        reply.status(500).send({
          error: {
            code: "internalError",
            message: "Validation failed",
            requestId: request.id,
          },
        })
      }
    }
  }
}

/** Validate request path parameters against a Zod schema. */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (request: FastifyRequest, reply: FastifyReply, done: () => void): void => {
    try {
      request.params = schema.parse(request.params)
      done()
    } catch (error) {
      if (error instanceof ZodError) {
        reply.status(400).send(validationErrorResponse(request, "Invalid path parameters", error))
      } else {
        reply.status(500).send({
          error: {
            code: "internalError",
            message: "Validation failed",
            requestId: request.id,
          },
        })
      }
    }
  }
}
