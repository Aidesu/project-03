import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApplicationsModule } from './applications/applications.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { RateLimitStorage } from './common/rate-limit.storage';
import { throttlerConfig } from './common/throttler.config';
import { CompaniesModule } from './companies/companies.module';
import { CompanyRegistryModule } from './company-registry/company-registry.module';
import { validateEnv } from './config/env.validation';
import { ContactsModule } from './contacts/contacts.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { GamificationModule } from './gamification/gamification.module';
import { InterviewsModule } from './interviews/interviews.module';
import { PrismaModule } from './prisma/prisma.module';
import { RemindersModule } from './reminders/reminders.module';
import { TagsModule } from './tags/tags.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Per-IP ceiling for the whole API + a per-identity limit on the
    // credential routes (see throttler.config.ts). Counters live in Redis so
    // they survive a restart and are shared across instances; see
    // rate-limit.storage.ts for the degraded path.
    ThrottlerModule.forRootAsync({
      imports: [CommonModule],
      inject: [RateLimitStorage],
      useFactory: (storage: RateLimitStorage) => ({
        ...throttlerConfig,
        storage,
      }),
    }),
    // Drives the audit-log retention purge (audit-retention.service.ts).
    ScheduleModule.forRoot(),
    CommonModule,
    PrismaModule,
    AuditModule,
    UsersModule,
    AuthModule,
    GamificationModule,
    ApplicationsModule,
    CompaniesModule,
    CompanyRegistryModule,
    ContactsModule,
    InterviewsModule,
    RemindersModule,
    TagsModule,
    EmailTemplatesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
