import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Connects lazily (Prisma opens the pool on first query) so the app — and the
 * `/health` endpoint — still boot when no database is configured. DB-backed
 * routes fail per-request instead of crashing startup.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
