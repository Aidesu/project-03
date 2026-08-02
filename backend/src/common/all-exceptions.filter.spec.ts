import {
  ArgumentsHost,
  ForbiddenException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let json: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    // The filter's whole job is to keep internals off the wire; the log side
    // is asserted only where it carries a signal, never for its contents.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    json = jest.fn();
    status = jest.fn(() => ({ json }));
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          method: 'POST',
          path: '/api/auth/login',
          correlationId: 'corr-1',
        }),
      }),
    } as unknown as ArgumentsHost;
    filter = new AllExceptionsFilter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes a deliberate 4xx through untouched', () => {
    filter.catch(new ForbiddenException('Nope'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
  });

  // csrf-csrf and the body parsers reject with a bare object carrying a
  // statusCode. Reporting those as 500 hides a security signal among real
  // server faults — and tells the client to retry something it cannot fix.
  it('honours the status of an Express-layer rejection', () => {
    filter.catch(
      { statusCode: 403, message: 'invalid csrf token', code: 'EBADCSRFTOKEN' },
      host,
    );

    expect(status).toHaveBeenCalledWith(403);
    const body = json.mock.calls[0][0] as { message: string };
    // The reason stays internal: the client gets the status, nothing more.
    expect(body.message).not.toContain('csrf');
  });

  it('still buries anything else in a bare 500', () => {
    filter.catch(new Error('connect ECONNREFUSED 10.0.0.5:5432'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0] as { message: string };
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('does not mistake a 5xx statusCode for a client rejection', () => {
    filter.catch({ statusCode: 502 }, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('carries the correlation ID so the log line can be found', () => {
    filter.catch(new Error('boom'), host);
    expect(
      (json.mock.calls[0][0] as { correlationId: string }).correlationId,
    ).toBe('corr-1');
  });
});
