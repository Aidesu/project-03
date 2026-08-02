import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-request-id';

/** Express request carrying the correlation ID assigned by the middleware. */
export type CorrelatedRequest = Request & { correlationId?: string };

// Only a UUID from an upstream hop is honoured. Anything else is replaced:
// the ID lands in log lines, so an attacker-controlled value would let a
// caller forge or inject log content.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Tags every request with a correlation ID, echoed back as `X-Request-Id`.
 * It is the only detail a client gets about a server-side failure — the cause
 * itself stays in the logs (see AllExceptionsFilter).
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: CorrelatedRequest, res: Response, next: NextFunction): void {
    const inbound = req.headers[CORRELATION_ID_HEADER];
    const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
    const id = candidate && UUID_RE.test(candidate) ? candidate : randomUUID();

    req.correlationId = id;
    res.setHeader(CORRELATION_ID_HEADER, id);
    next();
  }
}
