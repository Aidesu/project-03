import type { CorrelatedRequest } from './correlation-id.middleware';

/**
 * The request-scoped facts a service needs but must not reach into Express to
 * get: where the call came from and which request it belongs to. One object
 * serves both the session row and the audit entry.
 *
 * Every field is optional because a caller outside an HTTP request (a job, a
 * test) legitimately has none of them — an audit entry with no IP is still
 * worth writing.
 */
export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

/**
 * `req.ip` is only the real client when `trust proxy` matches the actual number
 * of hops in front of the app — see the note in main.ts. Misconfigured, every
 * audit entry records the load balancer.
 */
export function requestContext(req: CorrelatedRequest): RequestContext {
  return {
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    correlationId: req.correlationId ?? null,
  };
}
