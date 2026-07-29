import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

const CONTACT_DETAIL_INCLUDE = {
  company: { select: { id: true, name: true, logoUrl: true } },
  interviews: { orderBy: { scheduledAt: 'desc' } },
  _count: { select: { interviews: true, primaryForApplications: true } },
} satisfies Prisma.ContactInclude;

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateContactDto) {
    await this.assertCompany(userId, dto.companyId);
    return this.prisma.contact.create({
      data: {
        userId,
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        companyId: dto.companyId ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        title: dto.title ?? null,
        linkedinUrl: dto.linkedinUrl ?? null,
        notes: dto.notes ?? null,
      },
      include: { company: { select: { id: true, name: true, logoUrl: true } } },
    });
  }

  async findMany(userId: number, q: QueryContactsDto) {
    const where: Prisma.ContactWhereInput = { userId };
    if (q.companyId) where.companyId = q.companyId;
    if (q.search) {
      where.OR = [
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { lastName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, logoUrl: true } },
        },
        orderBy: { [q.sortBy]: q.sortOrder },
        ...skipTake(q.page, q.pageSize),
      }),
      this.prisma.contact.count({ where }),
    ]);

    return paginated(items, total, q.page, q.pageSize);
  }

  async findOne(userId: number, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, userId },
      include: CONTACT_DETAIL_INCLUDE,
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(userId: number, id: string, dto: UpdateContactDto) {
    await this.findOwnedOrThrow(userId, id);
    await this.assertCompany(userId, dto.companyId);
    return this.prisma.contact.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        companyId: dto.companyId,
        email: dto.email,
        phone: dto.phone,
        title: dto.title,
        linkedinUrl: dto.linkedinUrl,
        notes: dto.notes,
      },
      include: { company: { select: { id: true, name: true, logoUrl: true } } },
    });
  }

  async remove(userId: number, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    // Interviews/applications referencing this contact have their contactId nulled.
    await this.prisma.contact.delete({ where: { id } });
  }

  private async findOwnedOrThrow(userId: number, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, userId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  /** Ensure a linked company belongs to the same user (prevents cross-user linking). */
  private async assertCompany(userId: number, companyId?: string) {
    if (!companyId) return;
    const found = await this.prisma.company.count({
      where: { id: companyId, userId },
    });
    if (!found) throw new BadRequestException('Unknown company');
  }
}
