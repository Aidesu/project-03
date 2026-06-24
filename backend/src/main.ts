import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { CsrfService } from './auth/csrf.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All routes are served under /api (e.g. GET /api/health).
  app.setGlobalPrefix('api');

  // Security headers.
  app.use(helmet());

  // Parse cookies (auth tokens + CSRF token live in cookies).
  app.use(cookieParser());

  // CSRF double-submit protection on mutating requests (reads cookies above).
  app.use(app.get(CsrfService).protection);

  // Validate and strip unknown properties from incoming DTOs.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Allow the Angular dev server (configurable via CORS_ORIGIN). Credentials
  // are required so the browser sends/receives the auth cookies.
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
