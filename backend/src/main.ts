import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { CsrfService } from './auth/csrf.service';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a load balancer / ingress, req.ip is the proxy unless Express is
  // told how many hops to unwind — which would collapse every per-IP rate
  // limit into one shared bucket and record the proxy as the origin of every
  // session. Trust an exact hop count, never `true`: that would let any
  // client forge X-Forwarded-For and slip its own limits.
  const trustedProxyHops = Number(process.env.TRUSTED_PROXY_HOPS ?? 0);
  if (trustedProxyHops > 0) app.set('trust proxy', trustedProxyHops);

  // All routes are served under /api (e.g. GET /api/health).
  app.setGlobalPrefix('api');

  // Security headers.
  app.use(helmet());

  // Parse cookies (auth tokens + CSRF token live in cookies).
  app.use(cookieParser());

  // CSRF double-submit protection on mutating requests (reads cookies above).
  app.use(app.get(CsrfService).protection);

  // Validate incoming DTOs. `forbidNonWhitelisted` rejects unknown properties
  // instead of silently dropping them, so a client that thinks it is setting
  // `role` or `userId` gets a 400 rather than a success that quietly ignored it.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Generic errors out, detailed cause to the logs under a correlation ID.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Allow the Angular dev server (configurable via CORS_ORIGIN). Credentials
  // are required so the browser sends/receives the auth cookies.
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Without this, SIGTERM kills the process before onModuleDestroy runs, so
  // the Prisma pool and the Redis connection are never closed cleanly.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
