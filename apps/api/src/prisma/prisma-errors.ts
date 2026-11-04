import { Prisma } from '@prisma/client';

/** A unique / primary-key constraint lost a race (Prisma P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}
