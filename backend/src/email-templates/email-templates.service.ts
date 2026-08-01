import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: number, dto: CreateEmailTemplateDto) {
    return this.prisma.emailTemplate.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category ?? 'OTHER',
        subject: dto.subject,
        body: dto.body,
      },
    });
  }

  findMany(userId: number) {
    return this.prisma.emailTemplate.findMany({
      where: { userId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(userId: number, id: string) {
    return this.findOwnedOrThrow(userId, id);
  }

  async update(userId: number, id: string, dto: UpdateEmailTemplateDto) {
    await this.findOwnedOrThrow(userId, id);
    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        subject: dto.subject,
        body: dto.body,
      },
    });
  }

  async remove(userId: number, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    await this.prisma.emailTemplate.delete({ where: { id } });
  }

  private async findOwnedOrThrow(userId: number, id: string) {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, userId },
    });
    if (!template) throw new NotFoundException('Email template not found');
    return template;
  }
}
