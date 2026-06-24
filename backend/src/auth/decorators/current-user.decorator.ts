import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth.constants';
import { AccessTokenPayload } from '../token.service';

/**
 * Injects the authenticated user (decoded access-token payload), or one of its
 * fields: `@CurrentUser() user` / `@CurrentUser('sub') userId`.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AccessTokenPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    return field ? user?.[field] : user;
  },
);
