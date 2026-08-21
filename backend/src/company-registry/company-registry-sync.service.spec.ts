import { PrismaService } from '../prisma/prisma.service';
import { CompanyRegistrySyncService } from './company-registry-sync.service';
import { SireneClientService } from './sirene-client.service';
import type { SireneEtablissement } from './sirene-client.types';

const ORIGINAL_ENV = process.env;

function etab(
  overrides: Partial<SireneEtablissement> = {},
): SireneEtablissement {
  return {
    siret: '11111111100001',
    siren: '111111111',
    uniteLegale: { denominationUniteLegale: 'Acme SAS' },
    adresseEtablissement: {
      codePostalEtablissement: '75001',
      codeCommuneEtablissement: '75101',
      libelleCommuneEtablissement: 'Paris',
    },
    activitePrincipaleEtablissement: '62.01Z',
    etatAdministratifEtablissement: 'A',
    dateDernierTraitementEtablissement: '2026-01-01T00:00:00.000Z',
    statutDiffusionEtablissement: 'O',
    ...overrides,
  };
}

describe('CompanyRegistrySyncService', () => {
  let prisma: {
    registrySyncState: {
      upsert: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    companyRegistryEntry: { upsert: jest.Mock };
  };
  let sirene: { isConfigured: jest.Mock; search: jest.Mock };
  let service: CompanyRegistrySyncService;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    prisma = {
      registrySyncState: {
        upsert: jest
          .fn()
          .mockResolvedValue({ status: 'idle', lastCursor: null }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
      },
      companyRegistryEntry: { upsert: jest.fn().mockResolvedValue({}) },
    };
    sirene = {
      isConfigured: jest.fn().mockReturnValue(true),
      search: jest.fn(),
    };
    service = new CompanyRegistrySyncService(
      prisma as unknown as PrismaService,
      sirene as unknown as SireneClientService,
    );
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('runFullSync', () => {
    it('no-ops when no departments are configured', async () => {
      process.env.SIRENE_SYNC_DEPARTMENTS = '';
      await service.runFullSync();
      expect(sirene.search).not.toHaveBeenCalled();
    });

    it('no-ops when SIRENE credentials are not configured', async () => {
      process.env.SIRENE_SYNC_DEPARTMENTS = '75';
      sirene.isConfigured.mockReturnValue(false);
      await service.runFullSync();
      expect(sirene.search).not.toHaveBeenCalled();
    });

    it('paginates until the cursor stops advancing, upserting each page by siret', async () => {
      process.env.SIRENE_SYNC_DEPARTMENTS = '75';
      sirene.search
        .mockResolvedValueOnce({
          header: { total: 2, curseur: '*', curseurSuivant: 'page2' },
          etablissements: [etab({ siret: 'A' })],
        })
        .mockResolvedValueOnce({
          header: { total: 2, curseur: 'page2', curseurSuivant: 'page2' },
          etablissements: [etab({ siret: 'B' })],
        });

      await service.runFullSync();

      expect(sirene.search).toHaveBeenCalledTimes(2);
      expect(prisma.companyRegistryEntry.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.companyRegistryEntry.upsert.mock.calls[0][0].where).toEqual(
        {
          siret: 'A',
        },
      );
      expect(prisma.companyRegistryEntry.upsert.mock.calls[1][0].where).toEqual(
        {
          siret: 'B',
        },
      );
      expect(prisma.registrySyncState.update).toHaveBeenCalledWith({
        where: { id: 'sirene-fr' },
        data: expect.objectContaining({ status: 'idle' }),
      });
    });

    it('records the failure and rethrows when a page fetch fails', async () => {
      process.env.SIRENE_SYNC_DEPARTMENTS = '75';
      sirene.search.mockRejectedValue(new Error('SIRENE request failed: 500'));

      await expect(service.runFullSync()).rejects.toThrow(
        'SIRENE request failed',
      );

      expect(prisma.registrySyncState.update).toHaveBeenCalledWith({
        where: { id: 'sirene-fr' },
        data: expect.objectContaining({ status: 'error' }),
      });
    });

    it('marks non-diffusible rows accordingly instead of dropping them', async () => {
      process.env.SIRENE_SYNC_DEPARTMENTS = '75';
      sirene.search.mockResolvedValueOnce({
        header: { total: 1, curseur: '*', curseurSuivant: null },
        etablissements: [
          etab({ siret: 'C', statutDiffusionEtablissement: 'P' }),
        ],
      });

      await service.runFullSync();

      expect(
        prisma.companyRegistryEntry.upsert.mock.calls[0][0].create,
      ).toMatchObject({ isDiffusible: false });
    });
  });

  describe('runIncrementalSync', () => {
    it('does nothing without a prior sync watermark', async () => {
      process.env.SIRENE_SYNC_DEPARTMENTS = '75';
      prisma.registrySyncState.findUnique.mockResolvedValue(null);

      await service.runIncrementalSync();

      expect(sirene.search).not.toHaveBeenCalled();
    });

    it('never throws out of the cron tick, even when SIRENE fails', async () => {
      process.env.SIRENE_SYNC_DEPARTMENTS = '75';
      prisma.registrySyncState.findUnique.mockResolvedValue({
        lastFullSyncAt: new Date('2026-01-01'),
        lastIncrementalSyncAt: null,
      });
      sirene.search.mockRejectedValue(new Error('boom'));

      await expect(service.runIncrementalSync()).resolves.toBeUndefined();
    });
  });
});
