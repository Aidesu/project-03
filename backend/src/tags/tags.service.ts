import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateTagDto) {
    try {
      return await this.prisma.tag.create({
        data: { userId, name: dto.name, color: dto.color ?? null },
      });
    } catch (e) {
      throw this.rethrowDuplicate(e);
    }
  }

  findMany(userId: number) {
    return this.prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { applications: true } } },
    });
  }

  async findOne(userId: number, id: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id, userId },
      include: { _count: { select: { applications: true } } },
    });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  async update(userId: number, id: string, dto: UpdateTagDto) {
    await this.findOwnedOrThrow(userId, id);
    try {
      return await this.prisma.tag.update({
        where: { id },
        data: { name: dto.name, color: dto.color },
      });
    } catch (e) {
      throw this.rethrowDuplicate(e);
    }
  }

  async remove(userId: number, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    // ApplicationTag rows cascade-delete with the tag (see schema relation).
    await this.prisma.tag.delete({ where: { id } });
  }

  private async findOwnedOrThrow(userId: number, id: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id, userId } });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  /** Map the `@@unique([userId, name])` violation to a 409 instead of a 500. */
  private rethrowDuplicate(e: unknown): unknown {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException('A tag with this name already exists');
    }
    return e;
  }
}
