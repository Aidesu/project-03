import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All routes are served under /api (e.g. GET /api/health).
  app.setGlobalPrefix('api');

  // Validate and strip unknown properties from incoming DTOs.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Allow the Angular dev server (configurable via CORS_ORIGIN).
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
