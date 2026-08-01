import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DirectoryLinkingService,
  DirectoryLinkInput,
} from './directory-linking.service';

function buildInput(
  overrides: Partial<DirectoryLinkInput> = {},
): DirectoryLinkInput {
  return {
    name: 'Doctolib',
    website: 'https://www.doctolib.fr',
    industry: 'Health tech',
    location: 'Paris',
    size: '201-500',
    logoUrl: null,
    ...overrides,
  };
}

describe('DirectoryLinkingService', () => {
  let prisma: {
    directoryCompany: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
  };
  let service: DirectoryLinkingService;

  beforeEach(() => {
    prisma = {
      directoryCompany: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    service = new DirectoryLinkingService(prisma as unknown as PrismaService);
  });

  it('creates a new directory entry when nothing matches', async () => {
    prisma.directoryCompany.findUnique.mockResolvedValue(null);
    prisma.directoryCompany.create.mockResolvedValue({ id: 'dc-1' });

    const id = await service.linkToDirectory(buildInput());

    expect(id).toBe('dc-1');
    expect(prisma.directoryCompany.findUnique).toHaveBeenCalledWith({
      where: { websiteDomain: 'doctolib.fr' },
    });
    expect(prisma.directoryCompany.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Doctolib',
        websiteDomain: 'doctolib.fr',
        normalizedName: 'doctolib',
      }),
    });
  });

  it('falls back to normalizedName matching when there is no website', async () => {
    prisma.directoryCompany.findFirst.mockResolvedValue(null);
    prisma.directoryCompany.create.mockResolvedValue({ id: 'dc-2' });

    await service.linkToDirectory(buildInput({ website: null }));

    expect(prisma.directoryCompany.findUnique).not.toHaveBeenCalled();
    expect(prisma.directoryCompany.findFirst).toHaveBeenCalledWith({
      where: { normalizedName: 'doctolib' },
    });
  });

  it('links to an existing match instead of creating a duplicate', async () => {
    prisma.directoryCompany.findUnique.mockResolvedValue({
      id: 'dc-1',
      industry: 'Health tech',
      location: 'Paris',
      size: '201-500',
      logoUrl: 'https://logo.example/doctolib.png',
    });

    const id = await service.linkToDirectory(buildInput());

    expect(id).toBe('dc-1');
    expect(prisma.directoryCompany.create).not.toHaveBeenCalled();
  });

  it('enriches only currently-empty fields on a matched row, never overwriting existing values', async () => {
    prisma.directoryCompany.findUnique.mockResolvedValue({
      id: 'dc-1',
      name: 'Doctolib',
      website: 'https://doctolib.fr',
      industry: null, // empty -> should be filled
      location: 'Paris', // already set -> must not be touched
      size: null, // empty -> should be filled
      logoUrl: null,
    });

    await service.linkToDirectory(
      buildInput({
        industry: 'Health tech',
        location: 'Lyon',
        size: '201-500',
        logoUrl: null,
      }),
    );

    expect(prisma.directoryCompany.update).toHaveBeenCalledWith({
      where: { id: 'dc-1' },
      data: { industry: 'Health tech', size: '201-500' },
    });
  });

  it('does not write at all when the matched row has nothing new to enrich', async () => {
    prisma.directoryCompany.findUnique.mockResolvedValue({
      id: 'dc-1',
      name: 'Doctolib',
      website: 'https://doctolib.fr',
      industry: 'Health tech',
      location: 'Paris',
      size: '201-500',
      logoUrl: 'https://logo.example/doctolib.png',
    });

    await service.linkToDirectory(buildInput());

    expect(prisma.directoryCompany.update).not.toHaveBeenCalled();
  });

  it('recovers from a concurrent-insert race on websiteDomain instead of throwing', async () => {
    prisma.directoryCompany.findUnique.mockResolvedValue(null);
    prisma.directoryCompany.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );
    prisma.directoryCompany.findUniqueOrThrow.mockResolvedValue({
      id: 'dc-winner',
    });

    const id = await service.linkToDirectory(buildInput());

    expect(id).toBe('dc-winner');
    expect(prisma.directoryCompany.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { websiteDomain: 'doctolib.fr' },
    });
  });
});
