import type { PrismaService } from '../prisma/prisma.service';
import { OnboardingService } from './onboarding.service';

/** A one-table fake of the `user` surface submitAge() and status() touch. */
function fakeUsers() {
  const rows = new Map<string, Record<string, unknown>>();
  const user = {
    upsert: jest.fn(({ create }: { create: { id: string } }) => {
      if (!rows.has(create.id)) {
        rows.set(create.id, {
          ageAnswer: null,
          ageAnsweredAt: null,
          intakeCompletedAt: null,
          priorExperience: null,
          ...create,
        });
      }
      return Promise.resolve(rows.get(create.id));
    }),
    updateMany: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string; ageAnswer: null };
        data: Record<string, unknown>;
      }) => {
        const row = rows.get(where.id);
        if (!row || row.ageAnswer !== null) {
          return Promise.resolve({ count: 0 });
        }
        rows.set(where.id, { ...row, ...data });
        return Promise.resolve({ count: 1 });
      },
    ),
    findUnique: jest.fn(({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve(
        rows.has(id) ? { ...rows.get(id), placementAttempt: null } : null,
      ),
    ),
  };
  const prisma = { user } as unknown as PrismaService;
  return { prisma, rows, user };
}

describe('OnboardingService age question (M.5.a)', () => {
  it('reads a missing row as unanswered', async () => {
    const { prisma } = fakeUsers();
    await expect(
      new OnboardingService(prisma).status('user_none'),
    ).resolves.toEqual({
      ageAnswer: null,
      intakeDone: false,
      placement: 'not_needed',
    });
  });

  it('creates the row and stores the first answer with a timestamp', async () => {
    const { prisma, rows, user } = fakeUsers();
    const before = Date.now();
    const status = await new OnboardingService(prisma).submitAge(
      'user_new',
      'ADULT',
    );
    expect(status).toEqual({
      ageAnswer: 'ADULT',
      intakeDone: false,
      placement: 'not_needed',
    });
    expect(user.upsert).toHaveBeenCalledWith({
      where: { id: 'user_new' },
      update: {},
      create: { id: 'user_new' },
    });
    // Compare-and-set: only an unanswered row is written.
    expect(user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user_new', ageAnswer: null },
      data: { ageAnswer: 'ADULT', ageAnsweredAt: expect.any(Date) as Date },
    });
    const answeredAt = rows.get('user_new')?.ageAnsweredAt as Date;
    expect(answeredAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it.each([
    ['ADULT', 'UNDER_18'],
    ['UNDER_18', 'ADULT'],
  ] as const)(
    'never overwrites: %s then %s keeps the first',
    async (first, second) => {
      const { prisma, rows } = fakeUsers();
      const service = new OnboardingService(prisma);
      await service.submitAge('user_x', first);
      const answeredAt = rows.get('user_x')?.ageAnsweredAt;

      const status = await service.submitAge('user_x', second);
      expect(status.ageAnswer).toBe(first);
      expect(rows.get('user_x')).toMatchObject({
        ageAnswer: first,
        ageAnsweredAt: answeredAt,
      });
    },
  );
});
