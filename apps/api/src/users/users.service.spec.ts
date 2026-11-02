import type { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('upserts the user and returns the MeDto shape', async () => {
    const createdAt = new Date('2026-11-02T00:00:00.000Z');
    const upsert = jest.fn().mockResolvedValue({ id: 'user_abc', createdAt });
    const prisma = { user: { upsert } } as unknown as PrismaService;

    const service = new UsersService(prisma);
    const me = await service.ensureUser('user_abc');

    expect(upsert).toHaveBeenCalledWith({
      where: { id: 'user_abc' },
      update: {},
      create: { id: 'user_abc' },
    });
    expect(me).toEqual({
      id: 'user_abc',
      createdAt: '2026-11-02T00:00:00.000Z',
    });
  });
});
