/**
 * Security headers via @fastify/helmet (adapted from the vamios-core
 * skeleton). CSP allows inline styles + cross-origin loading because this
 * API also serves the Scalar docs UI at /docs.
 */
import helmet from "@fastify/helmet"
import type { FastifyInstance } from "fastify"
import fp from "fastify-plugin"

async function securityHeadersPlugin(app: FastifyInstance) {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Scalar's docs UI needs its own scripts/styles.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: false,
  })

  app.log.info("Security headers enabled via @fastify/helmet")
}

export default fp(securityHeadersPlugin, {
  name: "security-headers-plugin",
})
