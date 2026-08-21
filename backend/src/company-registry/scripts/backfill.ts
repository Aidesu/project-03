import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CompanyRegistrySyncService } from '../company-registry-sync.service';

/**
 * Manual, department-scoped full crawl of the SIRENE registry. Reads its
 * scope from SIRENE_SYNC_DEPARTMENTS (same env var the incremental cron
 * uses), so a full backfill and the daily incremental sync always agree on
 * what departments are being tracked.
 *
 * Run via: pnpm registry:backfill  (inside the backend container/env, with
 * SIRENE_CLIENT_ID/SIRENE_CLIENT_SECRET/SIRENE_SYNC_DEPARTMENTS set)
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const sync = app.get(CompanyRegistrySyncService);
    await sync.runFullSync();

    console.log('SIRENE full sync completed.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('SIRENE full sync failed:', err);
  process.exitCode = 1;
});
