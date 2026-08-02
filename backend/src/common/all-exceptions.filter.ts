import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CorrelatedRequest } from './correlation-id.middleware';

/** Lowest status we treat as "our bug": logged in full, generic on the wire. */
const SERVER_ERROR_FLOOR = 500;
const CLIENT_ERROR_FLOOR = 400;

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  correlationId?: string;
}

/**
 * Express-layer middleware (csrf-csrf, body parsers, multer) reports client
 * errors as a plain object carrying a numeric `statusCode`, not as a Nest
 * HttpException. Treating those as 500s buries a rejected CSRF token — an
 * ordinary 403 — in the noise of genuine server faults, and leaves the client
 * unable to tell a bug from a request it can fix.
 */
function clientErrorStatus(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const status = (exception as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' &&
    status >= CLIENT_ERROR_FLOOR &&
    status < SERVER_ERROR_FLOOR
    ? status
    : null;
}

/**
 * Fail closed and fail quiet: anything that isn't a deliberate HttpException
 * becomes a bare 500 carrying only a correlation ID. The real cause — driver
 * errors, constraint names, connection strings, stack frames — is logged
 * server-side and never reaches the wire.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<CorrelatedRequest>();
    const correlationId = req.correlationId;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const body: ErrorBody =
        typeof payload === 'string'
          ? { statusCode: status, error: exception.name, message: payload }
          : {
              error: exception.name,
              message: exception.message,
              ...(payload as Partial<ErrorBody>),
              statusCode: status,
            };

      // 5xx HttpExceptions are still our own bugs — log them with context.
      if (status >= SERVER_ERROR_FLOOR) {
        this.logFailure(req, correlationId, exception);
        res
          .status(status)
          .json({ ...body, message: 'Internal server error', correlationId });
        return;
      }

      res.status(status).json(body);
      return;
    }

    const rejected = clientErrorStatus(exception);
    if (rejected !== null) {
      // Worth a line — a CSRF rejection is a security signal — but not the
      // stack trace of a server fault, and still generic on the wire.
      this.logger.warn(
        `[${correlationId ?? 'no-correlation-id'}] ${req.method} ${req.path} rejected with ${rejected}`,
      );
      res.status(rejected).json({
        statusCode: rejected,
        error: 'Request rejected',
        message: 'Request rejected.',
        correlationId,
      });
      return;
    }

    this.logFailure(req, correlationId, exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
      correlationId,
    });
  }

  /**
   * Method + path + correlation ID only. Never the body, query string or
   * headers: they carry credentials and personal data, and this line is the
   * one that ships to log aggregation.
   */
  private logFailure(
    req: CorrelatedRequest,
    correlationId: string | undefined,
    exception: unknown,
  ): void {
    const where = `${req.method} ${req.path}`;
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `[${correlationId ?? 'no-correlation-id'}] ${where} failed: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
      stack,
    );
  }
}
