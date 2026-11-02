import { Injectable } from '@nestjs/common';
import type { MeDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the user row for an authenticated id, creating it on first sign-in
   * (L.6: a `users` row is created/linked keyed to the Clerk user id). Upsert
   * keeps it idempotent so repeated `/me` calls are a no-op.
   */
  async ensureUser(id: string): Promise<MeDto> {
    const user = await this.prisma.user.upsert({
      where: { id },
      update: {},
      create: { id },
    });
    return { id: user.id, createdAt: user.createdAt.toISOString() };
  }
}
