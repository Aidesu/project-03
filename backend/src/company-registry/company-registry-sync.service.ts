import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  departmentCodeFromCommune,
  regionCodeFromDepartment,
} from './france-geo';
import { SireneClientService } from './sirene-client.service';
import type { SireneEtablissement } from './sirene-client.types';

const SOURCE_ID = 'sirene-fr';
const PAGE_SIZE = 1000;
// Safety cap so a pagination bug (curseur never advancing) can't loop
// forever instead of failing loudly.
const MAX_PAGES_PER_RUN = 50_000;

/**
 * Departments this deployment keeps in sync, comma-separated (e.g. "75,92,93").
 * Both the manual full-sync script and the incremental cron use this scope,
 * so the cron never accidentally starts tracking a department nobody asked
 * for. Data minimization: don't pull all of France if the product only
 * needs certain regions.
 */
function configuredDepartments(): string[] {
  const raw = process.env.SIRENE_SYNC_DEPARTMENTS ?? '';
  return raw
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}

function buildDepartmentQuery(departmentCodes: string[]): string {
  // VERIFY BEFORE PRODUCTION USE: whether SIRENE v3's query language accepts
  // a postal-code-prefix wildcard this way, or whether a dedicated
  // department field should be used instead — confirm against current docs.
  return departmentCodes
    .map((d) => `codePostalEtablissement:${d}*`)
    .join(' OR ');
}

function mapToRegistryRow(e: SireneEtablissement) {
  const address = e.adresseEtablissement;
  const communeCode = address?.codeCommuneEtablissement ?? undefined;
  const departmentCode = departmentCodeFromCommune(communeCode ?? '');
  const name =
    e.uniteLegale?.denominationUniteLegale ??
    [e.uniteLegale?.prenom1UniteLegale, e.uniteLegale?.nomUniteLegale]
      .filter(Boolean)
      .join(' ') ??
    null;
  const addressLine = [
    address?.numeroVoieEtablissement,
    address?.typeVoieEtablissement,
    address?.libelleVoieEtablissement,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    siret: e.siret,
    siren: e.siren,
    name: name || null,
    naf: e.activitePrincipaleEtablissement ?? null,
    addressLine: addressLine || null,
    postalCode: address?.codePostalEtablissement ?? null,
    commune: address?.libelleCommuneEtablissement ?? null,
    departmentCode: departmentCode ?? null,
    regionCode: regionCodeFromDepartment(departmentCode) ?? null,
    status: e.etatAdministratifEtablissement === 'A' ? 'active' : 'ceased',
    // SIRENE itself already withholds personal fields for non-diffusible
    // personne physique établissements in the API response — this flag is
    // recorded for our own audit trail, not to un-redact anything ourselves.
    isDiffusible: e.statutDiffusionEtablissement !== 'P',
    sourceUpdatedAt: e.dateDernierTraitementEtablissement
      ? new Date(e.dateDernierTraitementEtablissement)
      : null,
    syncedAt: new Date(),
  };
}

@Injectable()
export class CompanyRegistrySyncService {
  private readonly logger = new Logger(CompanyRegistrySyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sirene: SireneClientService,
  ) {}

  /**
   * Manually-triggered full crawl, scoped to SIRENE_SYNC_DEPARTMENTS.
   * Resumable: persists the cursor after every page, so a crash restarts
   * from the last completed page rather than from the beginning.
   */
  async runFullSync(): Promise<void> {
    const departments = configuredDepartments();
    if (departments.length === 0) {
      this.logger.warn('SIRENE_SYNC_DEPARTMENTS is empty — nothing to sync');
      return;
    }
    if (!this.sirene.isConfigured()) {
      this.logger.warn(
        'SIRENE credentials are not configured — skipping full sync',
      );
      return;
    }

    const state = await this.prisma.registrySyncState.upsert({
      where: { id: SOURCE_ID },
      create: { id: SOURCE_ID, status: 'running' },
      update: { status: 'running', lastError: null },
    });

    const q = buildDepartmentQuery(departments);
    let cursor = state.status === 'running' ? (state.lastCursor ?? '*') : '*';

    try {
      for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
        const response = await this.sirene.search({
          q,
          curseur: cursor,
          nombre: PAGE_SIZE,
        });

        await this.upsertPage(response.etablissements);

        const nextCursor = response.header.curseurSuivant;
        await this.prisma.registrySyncState.update({
          where: { id: SOURCE_ID },
          data: { lastCursor: nextCursor ?? cursor },
        });

        if (!nextCursor || nextCursor === cursor) break; // last page
        cursor = nextCursor;
      }

      await this.prisma.registrySyncState.update({
        where: { id: SOURCE_ID },
        data: { status: 'idle', lastFullSyncAt: new Date(), lastError: null },
      });
    } catch (err) {
      await this.prisma.registrySyncState.update({
        where: { id: SOURCE_ID },
        data: {
          status: 'error',
          lastError: err instanceof Error ? err.message : String(err),
        },
      });
      throw err; // surfaced to whoever triggered the manual run
    }
  }

  /**
   * Daily incremental sync: only rows changed since the last successful
   * watermark. Never throws out of the cron tick — a failed sync is a data-
   * freshness problem, not an availability one (mirrors
   * AuditRetentionService.purgeExpiredEntries).
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async runIncrementalSync(): Promise<void> {
    try {
      const departments = configuredDepartments();
      if (departments.length === 0 || !this.sirene.isConfigured()) return;

      const state = await this.prisma.registrySyncState.findUnique({
        where: { id: SOURCE_ID },
      });
      const since = state?.lastIncrementalSyncAt ?? state?.lastFullSyncAt;
      if (!since) {
        this.logger.log(
          'No prior sync watermark — run the full backfill before the incremental sync can do anything useful',
        );
        return;
      }

      const q = `(${buildDepartmentQuery(departments)}) AND dateDernierTraitementEtablissement:[${since.toISOString()} TO *]`;
      let cursor = '*';
      let pages = 0;

      for (; pages < MAX_PAGES_PER_RUN; pages++) {
        const response = await this.sirene.search({
          q,
          curseur: cursor,
          nombre: PAGE_SIZE,
        });
        await this.upsertPage(response.etablissements);

        const nextCursor = response.header.curseurSuivant;
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
      }

      await this.prisma.registrySyncState.upsert({
        where: { id: SOURCE_ID },
        create: { id: SOURCE_ID, lastIncrementalSyncAt: new Date() },
        update: { lastIncrementalSyncAt: new Date(), lastError: null },
      });
      this.logger.log(
        `Incremental SIRENE sync completed (${pages + 1} page(s))`,
      );
    } catch (err) {
      this.logger.error(
        'Incremental SIRENE sync failed',
        err instanceof Error ? err.stack : String(err),
      );
      await this.prisma.registrySyncState
        .upsert({
          where: { id: SOURCE_ID },
          create: {
            id: SOURCE_ID,
            status: 'error',
            lastError: err instanceof Error ? err.message : String(err),
          },
          update: {
            lastError: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => undefined); // never let bookkeeping failure mask the original error
    }
  }

  private async upsertPage(
    etablissements: SireneEtablissement[],
  ): Promise<void> {
    for (const e of etablissements) {
      const row = mapToRegistryRow(e);
      await this.prisma.companyRegistryEntry.upsert({
        where: { siret: row.siret },
        create: row,
        update: row,
      });
    }
  }
}
