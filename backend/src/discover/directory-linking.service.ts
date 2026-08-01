import { Injectable } from '@nestjs/common';
import { DirectoryCompany, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeCompanyName,
  normalizeWebsiteDomain,
} from './directory-normalize';

export interface DirectoryLinkInput {
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  size: string | null;
  logoUrl: string | null;
}

/**
 * Find-or-create against the shared DirectoryCompany directory. Injected
 * into CompaniesService so directory-matching logic never grows inside the
 * per-user Companies module — mirrors how ApplicationsModule injects
 * GamificationService rather than inlining XP logic into ApplicationsService.
 */
@Injectable()
export class DirectoryLinkingService {
  constructor(private readonly prisma: PrismaService) {}

  async linkToDirectory(input: DirectoryLinkInput): Promise<string> {
    const websiteDomain = normalizeWebsiteDomain(input.website);
    const normalizedName = normalizeCompanyName(input.name);

    const existing = websiteDomain
      ? await this.prisma.directoryCompany.findUnique({
          where: { websiteDomain },
        })
      : await this.prisma.directoryCompany.findFirst({
          where: { normalizedName },
        });

    if (existing) {
      await this.enrichIfNeeded(existing, input);
      return existing.id;
    }

    try {
      const created = await this.prisma.directoryCompany.create({
        data: { ...input, websiteDomain, normalizedName },
      });
      return created.id;
    } catch (err) {
      // Race: a concurrent request created the same websiteDomain between our find and our create.
      if (
        websiteDomain &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const winner = await this.prisma.directoryCompany.findUniqueOrThrow({
          where: { websiteDomain },
        });
        return winner.id;
      }
      throw err;
    }
  }

  /**
   * Null-fills only currently-empty fields from a matched write — never
   * overwrites an existing value, and never touches name/website on an
   * already-matched row, so the canonical entry stays stable regardless of
   * how one particular contributor typed/edited their own private copy.
   */
  private async enrichIfNeeded(
    existing: DirectoryCompany,
    input: DirectoryLinkInput,
  ): Promise<void> {
    const data: Prisma.DirectoryCompanyUpdateInput = {};
    if (existing.industry == null && input.industry != null)
      data.industry = input.industry;
    if (existing.location == null && input.location != null)
      data.location = input.location;
    if (existing.size == null && input.size != null) data.size = input.size;
    if (existing.logoUrl == null && input.logoUrl != null)
      data.logoUrl = input.logoUrl;

    if (Object.keys(data).length > 0) {
      await this.prisma.directoryCompany.update({
        where: { id: existing.id },
        data,
      });
    }
  }
}
