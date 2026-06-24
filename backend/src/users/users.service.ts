import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** A user safe to expose over the API (password hash stripped). */
export type SafeUser = Omit<User, 'passwordHash'>;

/**
 * Build the client-safe view of a user. Uses an explicit allowlist (not an
 * exclusion) so a future sensitive column can never leak by accident.
 */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    name?: string | null;
    role?: Role;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
