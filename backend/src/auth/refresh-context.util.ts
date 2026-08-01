import type { Request } from 'express';
import type { RefreshContext } from './token.service';

export function refreshContext(req: Request): RefreshContext {
  return { userAgent: req.headers['user-agent'] ?? null, ip: req.ip ?? null };
}
