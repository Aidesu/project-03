import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, skipTake } from '../common/pagination';
import { DirectoryLinkingService } from '../discover/directory-linking.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const COMPANY_DETAIL_INCLUDE = {
  contacts: { orderBy: { firstName: 'asc' } },
  _count: { select: { applications: true, contacts: true } },
} satisfies Prisma.CompanyInclude;

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directoryLinking: DirectoryLinkingService,
  ) {}

  async create(userId: number, dto: CreateCompanyDto) {
    // Auto-aggregation: every new private Company opportunistically links
    // to (or creates) the shared Discover directory entry, using only the
    // safe field subset — never `notes`.
    const directoryCompanyId = await this.directoryLinking.linkToDirectory({
      name: dto.name,
      website: dto.website ?? null,
      industry: dto.industry ?? null,
      location: dto.location ?? null,
      size: dto.size ?? null,
      logoUrl: dto.logoUrl ?? null,
    });

    return this.prisma.company.create({
      data: {
        userId,
        name: dto.name,
        website: dto.website ?? null,
        industry: dto.industry ?? null,
        location: dto.location ?? null,
        size: dto.size ?? null,
        logoUrl: dto.logoUrl ?? null,
        notes: dto.notes ?? null,
        directoryCompanyId,
      },
    });
  }

  async findMany(userId: number, q: QueryCompaniesDto) {
    const where: Prisma.CompanyWhereInput = { userId };
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { industry: { contains: q.search, mode: 'insensitive' } },
        { location: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: { _count: { select: { applications: true, contacts: true } } },
        orderBy: { [q.sortBy]: q.sortOrder },
        ...skipTake(q.page, q.pageSize),
      }),
      this.prisma.company.count({ where }),
    ]);

    return paginated(items, total, q.page, q.pageSize);
  }

  async findOne(userId: number, id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, userId },
      include: COMPANY_DETAIL_INCLUDE,
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(userId: number, id: string, dto: UpdateCompanyDto) {
    const current = await this.findOwnedOrThrow(userId, id);

    // Re-link on any identity change, or lazily backfill rows created
    // before this feature shipped (directoryCompanyId still null) on their
    // next edit, whatever field that edit touches.
    const identityChanged = dto.name !== undefined || dto.website !== undefined;
    const directoryCompanyId =
      identityChanged || current.directoryCompanyId === null
        ? await this.directoryLinking.linkToDirectory({
            name: dto.name ?? current.name,
            website: dto.website !== undefined ? dto.website : current.website,
            industry: dto.industry !== undefined ? dto.industry : current.industry,
            location: dto.location !== undefined ? dto.location : current.location,
            size: dto.size !== undefined ? dto.size : current.size,
            logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : current.logoUrl,
          })
        : undefined;

    return this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        website: dto.website,
        industry: dto.industry,
        location: dto.location,
        size: dto.size,
        logoUrl: dto.logoUrl,
        notes: dto.notes,
        directoryCompanyId,
      },
    });
  }

  async remove(userId: number, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    // Applications/contacts keep their rows; their companyId is set null (schema).
    await this.prisma.company.delete({ where: { id } });
  }

  private async findOwnedOrThrow(userId: number, id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, userId },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }
}
